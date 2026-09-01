/**
 * Pages: the fixed structure of a site rather than its stream of posts.
 *
 * Two differences from posts drive everything here. Pages nest, through
 * `parent`, which is what produces /services/consulting rather than a flat
 * slug. And pages carry a `template`, which is how a theme decides whether one
 * renders full width or with a sidebar.
 *
 * Publishing a page is quieter than publishing a post, since pages are not in
 * the feed, but a live page is still a public URL that can be linked and
 * indexed, so the same confirmation applies.
 */

import { z } from "zod";
import { publishes } from "../safety.js";
import { confirmArg, defineTool, definedFields, pageArgs, siteArg, snippet } from "./kit.js";

const statusArg = z
  .enum(["publish", "future", "draft", "pending", "private"])
  .optional()
  .describe(
    "publish makes the page live at its URL immediately. draft, pending and private do not. Defaults to draft on create.",
  );

/**
 * The fields shared by create and update. Title and content are declared per
 * tool, since create requires a title and update does not.
 */
const pageFields = {
  excerpt: z.string().optional().describe("A short summary, used by some themes and in search results."),
  slug: z.string().optional().describe("The URL slug. Combined with any parent to form the full path."),
  parent: z
    .number()
    .int()
    .optional()
    .describe(
      "Page ID of the parent, which nests this page beneath it in the URL and the menu structure. 0 puts it at the top level.",
    ),
  menu_order: z
    .number()
    .int()
    .optional()
    .describe("Sort position among sibling pages. Lower comes first. Only matters where a theme or menu sorts by it."),
  template: z
    .string()
    .optional()
    .describe(
      "Theme template filename, such as page-full-width.php. Must be one the active theme actually offers, or WordPress rejects it.",
    ),
  featured_media: z.number().int().optional().describe("Attachment ID of the featured image."),
  comment_status: z.enum(["open", "closed"]).optional().describe("Whether comments are accepted."),
  meta: z
    .record(z.string(), z.any())
    .optional()
    .describe("Custom fields registered with show_in_rest. For anything else use wp_update_meta."),
};

export const listPages = defineTool({
  name: "wp_list_pages",
  title: "List pages",
  description:
    "List pages, filtered by status, search term, parent or slug. Returns the total count from the response headers alongside the rows. Filtering by `parent` is how to walk a site's structure one level at a time; ordering by menu_order gives the order a theme would show them in.",
  schema: {
    status: z
      .string()
      .optional()
      .describe("Comma-separated statuses, or `any`. Defaults to publish, so drafts are invisible unless named."),
    search: z.string().optional().describe("Free-text search across title and content."),
    parent: z.number().int().optional().describe("Only pages nested under this page ID. 0 returns top-level pages."),
    slug: z.string().optional().describe("Find by exact URL slug."),
    orderby: z
      .enum(["date", "modified", "title", "slug", "id", "menu_order", "parent"])
      .optional()
      .describe("Sort field. menu_order is the order a theme would display them in."),
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get("pages", {
      status: args.status ?? "publish",
      search: args.search,
      parent: args.parent,
      slug: args.slug,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 10,
      page: args.page ?? 1,
    }),
});

export const createPage = defineTool({
  name: "wp_create_page",
  title: "Create a page",
  description:
    "Create a page. Defaults to draft. Set `parent` to nest it under an existing page, which is what builds a path like /services/consulting rather than a top-level slug. Publishing puts a public URL live and needs confirm: true. For a page built in Elementor, duplicate an existing one with wp_duplicate_post instead: a page created here has no Elementor layout and opens blank in the builder.",
  schema: {
    title: z.string().describe("The page title."),
    content: z.string().optional().describe("The page body as HTML. Optional, since a builder may supply it later."),
    status: statusArg,
    ...pageFields,
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (publishes(args.status) ? "destructive" : "write"),
  surface: "core",
  summary: (args) => `publish the page "${snippet(args.title)}" at a live public URL`,
  handler: async (args, ctx) => {
    const body: Record<string, unknown> = {
      title: args.title,
      status: args.status ?? "draft",
      ...definedFields(args, [
        "content",
        "excerpt",
        "slug",
        "parent",
        "menu_order",
        "template",
        "featured_media",
        "comment_status",
        "meta",
      ]),
    };
    return ctx.client(args.site).post("pages", body);
  },
});

export const updatePage = defineTool({
  name: "wp_update_page",
  title: "Update a page",
  description:
    "Update any field on an existing page. Only the fields passed are changed. Passing `content` replaces the body outright rather than appending, and on a page built with Elementor it will not show: the builder stores its layout in meta and ignores post content entirely, so use wp_update_elementor for those.",
  schema: {
    page_id: z.number().int().describe("The page ID to update."),
    title: z.string().optional().describe("New title."),
    content: z
      .string()
      .optional()
      .describe("New body as HTML. Replaces the existing body outright."),
    status: statusArg,
    ...pageFields,
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (publishes(args.status) ? "destructive" : "write"),
  surface: "core",
  idempotent: true,
  summary: (args) => `publish page ${args.page_id}, putting it live at a public URL`,
  handler: async (args, ctx) => {
    const body = definedFields(args, [
      "title",
      "content",
      "status",
      "excerpt",
      "slug",
      "parent",
      "menu_order",
      "template",
      "featured_media",
      "comment_status",
      "meta",
    ]);
    return ctx.client(args.site).update(`pages/${args.page_id}`, body);
  },
});

export const PAGE_TOOLS = [listPages, createPage, updatePage];
