/**
 * Elementor page data.
 *
 * Elementor does not use post content. It stores the whole page as one
 * serialised JSON tree in the `_elementor_data` meta field, and the post's
 * `content` is left as a stub that the builder ignores. That single fact
 * explains most of what surprises people here:
 *
 * Editing an Elementor page with `wp_update_page` changes nothing visible.
 * Creating one with `wp_create_page` produces a page that opens blank in the
 * builder. Copying an Elementor page means copying its meta, which is what
 * `wp_duplicate_post` does and what recreating the content cannot.
 *
 * And a write here replaces the entire tree, since it is one field. Elementor
 * keeps its own revisions, but they are not reachable over the REST API, so
 * from this server an overwrite does not come back. That is why the update is
 * guarded and why it insists on being handed a tree that was read first.
 */

import { z } from "zod";
import { confirmArg, defineTool, definedFields, siteArg } from "./kit.js";
import { WordPressError } from "../api/errors.js";

export const getElementor = defineTool({
  name: "wp_get_elementor",
  title: "Read the Elementor layout of a page",
  description:
    "Read the Elementor widget tree for a page or post, as the JSON Elementor itself stores. This is the only way to see what is actually on an Elementor page: the post content is a stub the builder ignores, so wp_get_post returns nothing useful for one. Read this before wp_update_elementor, edit the tree that comes back, and write the whole thing back. Needs the helper plugin, and Elementor active on the site.",
  schema: {
    post_id: z.number().int().describe("The page or post ID."),
    ...siteArg,
  },
  risk: "read",
  surface: "helper",
  handler: async (args, ctx) =>
    ctx.client(args.site).helperGet(`elementor/${args.post_id}`, {}, "wp_get_elementor"),
});

export const updateElementor = defineTool({
  name: "wp_update_elementor",
  title: "Replace the Elementor layout of a page",
  description:
    "Replace the Elementor widget tree for a page or post. This overwrites the whole layout in one field rather than editing part of it, and Elementor's revision history is not reachable from here, so a wrong tree is not recoverable through this server. Always call wp_get_elementor first, modify what comes back, and send that: a tree assembled from scratch will not carry the widget IDs and settings Elementor needs, and the page will render empty. Needs confirm: true, the helper plugin, and Elementor active.",
  schema: {
    post_id: z.number().int().describe("The page or post ID."),
    elementor_data: z
      .string()
      .optional()
      .describe(
        "The complete Elementor widget tree, as a JSON string in exactly the shape wp_get_elementor returned. This replaces the existing layout entirely.",
      ),
    title: z.string().optional().describe("Also update the post title, which the builder does not own."),
    status: z
      .enum(["publish", "draft", "pending", "private"])
      .optional()
      .describe("Also update the post status."),
    ...siteArg,
    ...confirmArg,
  },
  risk: "destructive",
  surface: "helper",
  summary: (args) =>
    `replace the entire Elementor layout on post ${args.post_id}, which cannot be undone from here`,
  handler: async (args, ctx) => {
    // Elementor reads this field with json_decode and renders nothing at all if
    // it fails. Catching that here costs one parse and saves a blank page.
    if (args.elementor_data !== undefined) {
      try {
        const parsed = JSON.parse(args.elementor_data) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("the top level of an Elementor tree is an array of sections");
        }
      } catch (error) {
        throw new WordPressError({
          message: `elementor_data is not a valid Elementor tree: ${(error as Error).message}. Read the page with wp_get_elementor and send back the same shape, edited. Writing anything else renders the page blank.`,
          status: 400,
          code: "invalid_elementor_data",
          site: ctx.site(args.site).name,
          endpoint: `elementor/${args.post_id}`,
        });
      }
    }

    const body = definedFields(args, ["elementor_data", "title", "status"]);
    return ctx.client(args.site).helperPost(`elementor/${args.post_id}`, body, "wp_update_elementor");
  },
});

export const BUILDER_TOOLS = [getElementor, updateElementor];
