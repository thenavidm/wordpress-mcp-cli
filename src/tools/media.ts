/**
 * The media library.
 *
 * Uploading is the one endpoint in WordPress that does not take JSON: it wants
 * the raw bytes with the filename in a Content-Disposition header, and it
 * accepts no other fields in the same request. So an upload with a title and
 * alt text is two calls, and `wp_upload_media` does both rather than returning
 * an untitled attachment and leaving the caller to discover why.
 *
 * The upload source is a URL rather than a local path on purpose. This server
 * can be running on the user's laptop or hosted somewhere else entirely, and a
 * hosted one has no access to their filesystem, so a path argument would work
 * in one deployment and silently fail in the other.
 */

import { z } from "zod";
import { confirmArg, defineTool, definedFields, pageArgs, siteArg, snippet } from "./kit.js";
import { WordPressError } from "../api/errors.js";

/** Guard against pulling something enormous into memory on a serverless host. */
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export const listMedia = defineTool({
  name: "wp_list_media",
  title: "List media library items",
  description:
    "List items in the media library, filtered by search term, MIME type or the post they are attached to. Returns the total count from the response headers. Search matches the title, filename, alt text and caption, so it finds an image by what it was called on disk as well as by what it was titled.",
  schema: {
    search: z.string().optional().describe("Free-text search across title, filename, alt text and caption."),
    media_type: z
      .enum(["image", "video", "audio", "application", "text"])
      .optional()
      .describe("Restrict to one broad kind of file."),
    mime_type: z.string().optional().describe("Restrict to an exact MIME type, such as image/webp or application/pdf."),
    parent: z.number().int().optional().describe("Only items attached to this post or page ID."),
    orderby: z.enum(["date", "modified", "title", "id"]).optional().describe("Sort field. Defaults to date."),
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction. Defaults to desc."),
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get("media", {
      search: args.search,
      media_type: args.media_type,
      mime_type: args.mime_type,
      parent: args.parent,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 10,
      page: args.page ?? 1,
    }),
});

export const getMedia = defineTool({
  name: "wp_get_media",
  title: "Get one media item by ID",
  description:
    "Fetch a single attachment by ID, with its full URL, dimensions, alt text, caption and every generated size. The generated sizes are worth reading before linking an image into content: WordPress creates several and the full-size original is often far larger than a page should load.",
  schema: {
    media_id: z.number().int().describe("The attachment ID."),
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => ctx.client(args.site).get(`media/${args.media_id}`, { context: "edit" }),
});

export const uploadMedia = defineTool({
  name: "wp_upload_media",
  title: "Upload a file to the media library from a URL",
  description:
    "Download a file from a publicly reachable URL and add it to the media library, then set its title, alt text and caption. Returns the attachment, whose `id` is what wp_create_post and wp_update_post take as featured_media. The source must be reachable without authentication, since the server fetches it directly. Always set alt_text on an image: it is what screen readers announce and what search engines read, and WordPress leaves it empty otherwise.",
  schema: {
    file_url: z
      .string()
      .url()
      .describe("Publicly reachable URL of the file to upload. Must not require a login or a signed URL."),
    filename: z
      .string()
      .optional()
      .describe("Override the filename stored on the site. Defaults to the last path segment of the source URL."),
    title: z.string().optional().describe("Media library title. Defaults to the filename."),
    alt_text: z
      .string()
      .optional()
      .describe("Alt text, describing the image for screen readers and search engines. Set this on every image."),
    caption: z.string().optional().describe("Caption, which many themes display beneath the image."),
    description: z.string().optional().describe("Longer description, shown on the attachment page."),
    post: z.number().int().optional().describe("Attach the file to this post or page ID."),
    ...siteArg,
  },
  risk: "write",
  surface: "core",
  summary: (args) => `upload ${snippet(args.filename ?? args.file_url)} to the media library`,
  handler: async (args, ctx) => {
    const client = ctx.client(args.site);

    const source = await fetch(args.file_url).catch((error: unknown) => {
      throw new WordPressError({
        message: `Could not download the source file from ${args.file_url}. ${(error as Error).message}`,
        status: 0,
        code: "source_unreachable",
        site: client.name,
        endpoint: args.file_url,
      });
    });

    if (!source.ok) {
      throw new WordPressError({
        message: `The source URL returned ${source.status}. The file has to be reachable without a login, since this server fetches it directly.`,
        status: source.status,
        code: "source_unreachable",
        site: client.name,
        endpoint: args.file_url,
      });
    }

    const declared = Number(source.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES) {
      throw new WordPressError({
        message: `That file is ${Math.round(declared / 1024 / 1024)}MB, over the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB this tool will pull into memory. Upload it through wp-admin instead.`,
        status: 413,
        code: "source_too_large",
        site: client.name,
        endpoint: args.file_url,
      });
    }

    const bytes = Buffer.from(await source.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new WordPressError({
        message: `That file is over the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit this tool will handle. Upload it through wp-admin instead.`,
        status: 413,
        code: "source_too_large",
        site: client.name,
        endpoint: args.file_url,
      });
    }

    const filename =
      args.filename?.trim() ||
      decodeURIComponent(new URL(args.file_url).pathname.split("/").pop() || "") ||
      "upload.bin";

    const created = (await client.uploadMedia({
      bytes,
      filename,
      contentType: source.headers.get("content-type") || "application/octet-stream",
    })) as { id?: number };

    // Title, alt text and caption cannot ride along with the bytes, so they are
    // a second call. Returning the untitled attachment would look like the
    // arguments were ignored.
    const details = definedFields(args, ["title", "alt_text", "caption", "description", "post"]);
    if (created?.id && Object.keys(details).length > 0) {
      return client.update(`media/${created.id}`, details);
    }
    return created;
  },
});

export const deleteMedia = defineTool({
  name: "wp_delete_media",
  title: "Delete a media item",
  description:
    "Delete an attachment. WordPress does not trash media the way it trashes posts, so this is permanent as soon as force is set, and force is required by the API for attachments. The file leaves the server along with every generated size, and any post still linking to it will show a broken image, so check with wp_list_media whether anything is using it first.",
  schema: {
    media_id: z.number().int().describe("The attachment ID to delete."),
    force: z
      .boolean()
      .optional()
      .describe(
        "WordPress requires force for attachments and rejects the call without it, so this defaults to true. There is no trash step for media.",
      ),
    ...siteArg,
    ...confirmArg,
  },
  risk: "destructive",
  surface: "core",
  summary: (args) => `permanently delete media ${args.media_id} and every size generated from it`,
  handler: async (args, ctx) =>
    ctx.client(args.site).delete(`media/${args.media_id}`, { force: args.force ?? true }),
});

export const MEDIA_TOOLS = [listMedia, getMedia, uploadMedia, deleteMedia];
