/**
 * Posts: the blog side of a WordPress install.
 *
 * The one thing worth understanding before calling anything here is that
 * `status` is not a label, it is an action. Setting it to `publish` puts the
 * post in front of every RSS reader, mailing list plugin and social
 * auto-poster subscribed to the site, usually within minutes. Setting it back
 * to `draft` removes the page and does nothing about the copies already sent.
 *
 * So publishing is guarded and drafting is not, and every tool here that can
 * publish says so in its own description rather than leaving it to be
 * discovered.
 */

import { z } from "zod";
import { publishes } from "../safety.js";
import { confirmArg, defineTool, definedFields, on, pageArgs, siteArg, snippet } from "./kit.js";

const statusValues = ["publish", "future", "draft", "pending", "private"] as const;

/**
 * The fields shared by create and update.
 *
 * Title and content are deliberately absent: they are required on create and
 * optional on update, so each tool declares its own rather than having a shared
 * optional version silently overwrite the required one.
 */
const contentArgs = {
  excerpt: z
    .string()
    .optional()
    .describe("A short summary, used in listings and feeds. WordPress generates one when this is empty."),
  slug: z
    .string()
    .optional()
    .describe("The URL slug. WordPress derives one from the title when this is empty, and will add a suffix if it collides."),
  categories: z
    .array(z.number().int())
    .optional()
    .describe("Category IDs, not names. Get them from wp_list_categories, or create one with wp_create_category."),
  tags: z
    .array(z.number().int())
    .optional()
    .describe("Tag IDs, not names. Get them from wp_list_tags, or create one with wp_create_tag."),
  featured_media: z
    .number()
    .int()
    .optional()
    .describe("Attachment ID of the featured image, from wp_upload_media or wp_list_media."),
  author: z.number().int().optional().describe("User ID of the author. Needs a role that can edit others' posts."),
  sticky: z.boolean().optional().describe("Pin the post to the top of the blog listing."),
  comment_status: z.enum(["open", "closed"]).optional().describe("Whether comments are accepted on this post."),
  meta: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Custom fields as key-value pairs. Only fields registered with show_in_rest are writable here. For anything else, including most ACF and Elementor data, use wp_update_meta, which goes through the helper plugin.",
    ),
};

const statusArg = z
  .enum(statusValues)
  .optional()
  .describe(
    "publish makes it live immediately and it goes out to RSS and any mailing list plugin. future schedules it, and needs `date` set to a time ahead. draft, pending and private do not publish. Defaults to draft on create, which is deliberate: publishing is the one action here that cannot be taken back.",
  );

export const listPosts = defineTool({
  name: "wp_list_posts",
  title: "List posts",
  description:
    "List posts, filtered by status, search term, category, tag, author or date range. Returns the total count and page count from the response headers alongside the rows, so a listing that returned ten of four hundred says so rather than reading as the whole set. Note that `status` defaults to publish: drafts do not appear unless asked for.",
  schema: {
    status: z
      .string()
      .optional()
      .describe(
        "Comma-separated statuses: publish, draft, pending, private, future, trash, or `any` for everything. Defaults to publish, so drafts are invisible unless named.",
      ),
    search: z.string().optional().describe("Free-text search across title and content."),
    categories: z.string().optional().describe("Category IDs, comma-separated. Posts in any of them match."),
    tags: z.string().optional().describe("Tag IDs, comma-separated. Posts with any of them match."),
    author: z.string().optional().describe("Author user IDs, comma-separated."),
    slug: z.string().optional().describe("Find by exact URL slug, which is how to resolve a known URL to an ID."),
    after: z.string().optional().describe("Only posts published after this ISO 8601 date."),
    before: z.string().optional().describe("Only posts published before this ISO 8601 date."),
    orderby: z
      .enum(["date", "modified", "title", "slug", "id", "relevance", "author"])
      .optional()
      .describe("Sort field. Defaults to date. `relevance` only means anything alongside `search`."),
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction. Defaults to desc."),
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get("posts", {
      status: args.status ?? "publish",
      search: args.search,
      categories: args.categories,
      tags: args.tags,
      author: args.author,
      slug: args.slug,
      after: args.after,
      before: args.before,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 10,
      page: args.page ?? 1,
    }),
});

export const getPost = defineTool({
  name: "wp_get_post",
  title: "Get one post by ID",
  description:
    "Fetch a single post by ID, in edit context so the raw unrendered content comes back rather than the filtered output. That distinction matters when the content is about to be edited and written back: the rendered version has shortcodes expanded and blocks resolved, and saving it would destroy them.",
  schema: {
    post_id: z.number().int().describe("The post ID."),
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => ctx.client(args.site).get(`posts/${args.post_id}`, { context: "edit" }),
});

export const createPost = defineTool({
  name: "wp_create_post",
  title: "Create a post",
  description:
    "Create a post. Defaults to draft, which is the safe thing to do and almost always what is wanted. Passing status `publish` makes it live immediately and sends it to RSS readers and any mailing list plugin on the site, so that path needs confirm: true. Category and tag arguments take IDs, not names.",
  schema: {
    title: z.string().describe("The post title, as plain text."),
    content: z.string().describe("The post body as HTML, or Gutenberg block markup."),
    status: statusArg,
    date: z
      .string()
      .optional()
      .describe(
        "Publish date as ISO 8601, interpreted in the site's timezone rather than yours. Read wp_get_settings for that timezone. Required when status is future, and setting a past date with status publish backdates the post.",
      ),
    ...contentArgs,
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (publishes(args.status) ? "destructive" : "write"),
  surface: "core",
  summary: (args) =>
    `publish "${snippet(args.title)}" immediately on the site, where RSS and any mailing list plugin will pick it up`,
  handler: async (args, ctx) => {
    const body: Record<string, unknown> = {
      title: args.title,
      content: args.content,
      status: args.status ?? "draft",
      ...definedFields(args, [
        "excerpt",
        "slug",
        "categories",
        "tags",
        "featured_media",
        "author",
        "sticky",
        "comment_status",
        "meta",
        "date",
      ]),
    };
    return ctx.client(args.site).post("posts", body);
  },
});

export const updatePost = defineTool({
  name: "wp_update_post",
  title: "Update a post",
  description:
    "Update any field on an existing post. Only the fields passed are changed, so this is safe to use for a single edit without resending the whole post. Moving the status to publish or future is what makes this irreversible, and only that path needs confirm: true. Passing `content` replaces the body outright rather than appending to it, so read the post first if the intent is to add to it.",
  schema: {
    post_id: z.number().int().describe("The post ID to update."),
    title: z.string().optional().describe("New title."),
    content: z
      .string()
      .optional()
      .describe(
        "New body as HTML, or Gutenberg block markup. This replaces the existing body outright rather than appending to it, so read the post first if the intent is to add to it.",
      ),
    status: statusArg,
    date: z.string().optional().describe("Publish date as ISO 8601, in the site's timezone."),
    ...contentArgs,
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (publishes(args.status) ? "destructive" : "write"),
  surface: "core",
  idempotent: true,
  summary: (args) => `publish post ${args.post_id}, making it live and visible to feeds`,
  handler: async (args, ctx) => {
    const body = definedFields(args, [
      "title",
      "content",
      "status",
      "excerpt",
      "slug",
      "categories",
      "tags",
      "featured_media",
      "author",
      "sticky",
      "comment_status",
      "meta",
      "date",
    ]);
    return ctx.client(args.site).update(`posts/${args.post_id}`, body);
  },
});

export const deletePost = defineTool({
  name: "wp_delete_post",
  title: "Trash or delete a post",
  description:
    "Move a post to the trash, where it stays until emptied and can be restored from wp-admin in one click. That is the default and it is reversible. Passing force: true skips the trash and deletes the post and its metadata permanently, which cannot be undone and needs confirm: true.",
  schema: {
    post_id: z.number().int().describe("The post ID."),
    force: z
      .boolean()
      .optional()
      .describe("Skip the trash and delete permanently. Not recoverable. Defaults to false, which trashes."),
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (args.force ? "destructive" : "write"),
  surface: "core",
  summary: (args) => `permanently delete post ${args.post_id}, with no way to restore it`,
  handler: async (args, ctx) =>
    ctx.client(args.site).delete(`posts/${args.post_id}`, args.force ? { force: true } : {}),
});

export const duplicatePost = defineTool({
  name: "wp_duplicate_post",
  title: "Duplicate a post, page or custom post type item",
  description:
    "Duplicate any post, page or custom post type item as a draft, copying every meta field with it, including Elementor layouts, ACF fields and SEO settings. This is the reliable way to reuse a built page: recreating one by copying content through wp_create_post loses everything stored in meta, which on an Elementor page is the entire layout. Needs the helper plugin.",
  schema: {
    post_id: z.number().int().describe("The ID of the post, page or item to duplicate."),
    new_title: z
      .string()
      .optional()
      .describe("Title for the copy. Defaults to the original title prefixed with 'Copy of'."),
    ...siteArg,
  },
  risk: "write",
  surface: "helper",
  summary: (args) => `duplicate post ${args.post_id} as a new draft`,
  handler: async (args, ctx) =>
    ctx.client(args.site).helperPost(
      "duplicate",
      definedFields(args, ["post_id", "new_title"]),
      "wp_duplicate_post",
    ),
});

export const POST_TOOLS = [listPosts, getPost, createPost, updatePost, deletePost, duplicatePost];
