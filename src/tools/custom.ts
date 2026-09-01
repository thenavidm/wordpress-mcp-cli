/**
 * Custom post types, which is where most real WordPress sites keep their content.
 *
 * A site running WooCommerce, a directory, a course platform or a portfolio
 * stores almost nothing in `posts`. It stores products, listings, lessons and
 * projects, each a registered post type with its own REST base.
 *
 * Two rules make this group work. Everything is addressed by REST base, not by
 * the label shown in wp-admin, and `wp_list_post_types` is what maps one to the
 * other. And a post type registered without `show_in_rest` does not appear here
 * and cannot be reached at all, which is a site configuration problem rather
 * than something to retry differently.
 */

import { z } from "zod";
import { publishes } from "../safety.js";
import { confirmArg, defineTool, definedFields, pageArgs, siteArg, snippet } from "./kit.js";

export const listPostTypes = defineTool({
  name: "wp_list_post_types",
  title: "List every registered post type",
  description:
    "List every post type registered on the site, built in and custom, with the REST base each one answers on, whether it is hierarchical, and which taxonomies apply to it. Call this before touching a custom post type: every other tool in this group is addressed by REST base, and the base regularly differs from both the label in wp-admin and the internal slug. A post type registered without show_in_rest will not appear, and that means the REST API cannot reach it however it is asked for.",
  schema: { ...siteArg },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => {
    const raw = (await ctx.client(args.site).get("types", { context: "edit" })) as Record<
      string,
      {
        name?: string;
        slug?: string;
        rest_base?: string;
        hierarchical?: boolean;
        taxonomies?: string[];
        supports?: Record<string, boolean>;
      }
    >;
    return Object.fromEntries(
      Object.entries(raw ?? {}).map(([key, value]) => [
        key,
        {
          name: value?.name,
          slug: value?.slug,
          rest_base: value?.rest_base,
          hierarchical: value?.hierarchical,
          taxonomies: value?.taxonomies,
          supports: value?.supports ? Object.keys(value.supports) : undefined,
        },
      ]),
    );
  },
});

export const listCustom = defineTool({
  name: "wp_list_custom",
  title: "List items of any custom post type",
  description:
    "List items of any post type by its REST base: products, listings, lessons, projects, or whatever the site has registered. Filters and pagination work as they do for posts, and the total count comes back from the response headers. Get the REST base from wp_list_post_types.",
  schema: {
    post_type: z
      .string()
      .describe("REST base of the post type, from wp_list_post_types. Not the label shown in wp-admin."),
    status: z
      .string()
      .optional()
      .describe("Comma-separated statuses, or `any`. Defaults to publish, so drafts are invisible unless named."),
    search: z.string().optional().describe("Free-text search across title and content."),
    slug: z.string().optional().describe("Find by exact URL slug."),
    parent: z.number().int().optional().describe("For a hierarchical post type, only items under this parent ID."),
    orderby: z
      .enum(["date", "modified", "title", "slug", "id", "menu_order"])
      .optional()
      .describe("Sort field. Defaults to date."),
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction. Defaults to desc."),
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get(args.post_type, {
      status: args.status ?? "publish",
      search: args.search,
      slug: args.slug,
      parent: args.parent,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 10,
      page: args.page ?? 1,
    }),
});

export const getCustom = defineTool({
  name: "wp_get_custom",
  title: "Get one custom post type item",
  description:
    "Fetch a single item of any post type by REST base and ID, in edit context so the raw content comes back rather than the rendered output. Note that most of what makes a custom post type useful usually lives in meta fields, and only fields registered with show_in_rest appear here. wp_get_all_meta returns the rest.",
  schema: {
    post_type: z.string().describe("REST base of the post type."),
    item_id: z.number().int().describe("The item ID."),
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get(`${args.post_type}/${args.item_id}`, { context: "edit" }),
});

export const createCustom = defineTool({
  name: "wp_create_custom",
  title: "Create a custom post type item",
  description:
    "Create an item in any post type by REST base. Defaults to draft. The `meta` argument only writes fields the site registered with show_in_rest; for ACF fields and anything else, create the item here and then set the fields with wp_update_meta.",
  schema: {
    post_type: z.string().describe("REST base of the post type."),
    title: z.string().describe("The item title."),
    content: z.string().optional().describe("The body as HTML, where the post type supports an editor."),
    status: z
      .enum(["publish", "future", "draft", "pending", "private"])
      .optional()
      .describe("publish makes it live immediately. Defaults to draft."),
    excerpt: z.string().optional().describe("A short summary, where the post type supports one."),
    slug: z.string().optional().describe("URL slug. Derived from the title when empty."),
    parent: z.number().int().optional().describe("Parent item ID, for a hierarchical post type."),
    menu_order: z.number().int().optional().describe("Sort position among siblings."),
    featured_media: z.number().int().optional().describe("Attachment ID of the featured image."),
    meta: z
      .record(z.string(), z.any())
      .optional()
      .describe("Custom fields, limited to those registered with show_in_rest. Use wp_update_meta for the others."),
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (publishes(args.status) ? "destructive" : "write"),
  surface: "core",
  summary: (args) => `publish "${snippet(args.title)}" as a live ${args.post_type} item`,
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
        "featured_media",
        "meta",
      ]),
    };
    return ctx.client(args.site).post(args.post_type, body);
  },
});

export const updateCustom = defineTool({
  name: "wp_update_custom",
  title: "Update a custom post type item",
  description:
    "Update any field on an item of any post type. Only the fields passed are changed. Moving the status to publish is what makes this irreversible and needs confirm: true.",
  schema: {
    post_type: z.string().describe("REST base of the post type."),
    item_id: z.number().int().describe("The item ID to update."),
    title: z.string().optional().describe("New title."),
    content: z.string().optional().describe("New body as HTML. Replaces the existing body outright."),
    status: z
      .enum(["publish", "future", "draft", "pending", "private"])
      .optional()
      .describe("New status. publish makes it live."),
    excerpt: z.string().optional().describe("New excerpt."),
    slug: z.string().optional().describe("New URL slug. Changing this changes the item's public URL."),
    parent: z.number().int().optional().describe("New parent item ID."),
    menu_order: z.number().int().optional().describe("New sort position."),
    featured_media: z.number().int().optional().describe("New featured image attachment ID."),
    meta: z.record(z.string(), z.any()).optional().describe("Custom fields registered with show_in_rest."),
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (publishes(args.status) ? "destructive" : "write"),
  surface: "core",
  idempotent: true,
  summary: (args) => `publish ${args.post_type} item ${args.item_id}, making it live`,
  handler: async (args, ctx) => {
    const body = definedFields(args, [
      "title",
      "content",
      "status",
      "excerpt",
      "slug",
      "parent",
      "menu_order",
      "featured_media",
      "meta",
    ]);
    return ctx.client(args.site).update(`${args.post_type}/${args.item_id}`, body);
  },
});

export const deleteCustom = defineTool({
  name: "wp_delete_custom",
  title: "Trash or delete a custom post type item",
  description:
    "Move an item of any post type to the trash, which is reversible, or delete it permanently with force: true, which is not. Some post types are registered without trash support, in which case WordPress deletes immediately whatever force is set to, so treat a delete on an unfamiliar post type as permanent.",
  schema: {
    post_type: z.string().describe("REST base of the post type."),
    item_id: z.number().int().describe("The item ID."),
    force: z.boolean().optional().describe("Skip the trash and delete permanently. Defaults to false."),
    ...siteArg,
    ...confirmArg,
  },
  risk: (args) => (args.force ? "destructive" : "write"),
  surface: "core",
  summary: (args) => `permanently delete ${args.post_type} item ${args.item_id}`,
  handler: async (args, ctx) =>
    ctx
      .client(args.site)
      .delete(`${args.post_type}/${args.item_id}`, args.force ? { force: true } : {}),
});

export const CUSTOM_TOOLS = [
  listPostTypes,
  listCustom,
  getCustom,
  createCustom,
  updateCustom,
  deleteCustom,
];
