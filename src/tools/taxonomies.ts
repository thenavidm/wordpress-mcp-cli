/**
 * Categories, tags, and whatever else the site has registered.
 *
 * The recurring trap is that posts take term IDs, never names. Asking to file
 * a post under "Marketing" means looking the term up first, and creating it
 * when it does not exist, so `wp_list_categories` and `wp_create_category` are
 * usually called before `wp_create_post` rather than on their own.
 *
 * Custom taxonomies are reached by their REST base, not their slug, and the two
 * differ often enough that guessing fails. `wp_list_taxonomies` is what turns
 * one into the other.
 */

import { z } from "zod";
import { defineTool, definedFields, pageArgs, siteArg, snippet } from "./kit.js";

const termListArgs = {
  search: z.string().optional().describe("Free-text search across term names and descriptions."),
  slug: z.string().optional().describe("Find by exact slug."),
  parent: z.number().int().optional().describe("Only terms nested under this term ID. Hierarchical taxonomies only."),
  hide_empty: z.boolean().optional().describe("Leave out terms with no posts attached."),
  orderby: z
    .enum(["name", "slug", "count", "id", "term_group", "description"])
    .optional()
    .describe("Sort field. `count` ranks by how many posts use the term, which is the useful one for finding the real topics of a site."),
  order: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
};

export const listCategories = defineTool({
  name: "wp_list_categories",
  title: "List categories",
  description:
    "List the site's categories with their IDs, slugs, parents and post counts. The ID is what wp_create_post and wp_update_post take: they will not accept a category name. Ordering by count is the quickest way to see what a site is actually about rather than what it was set up to be about.",
  schema: { ...termListArgs, ...pageArgs, ...siteArg },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get("categories", {
      search: args.search,
      slug: args.slug,
      parent: args.parent,
      hide_empty: args.hide_empty,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 100,
      page: args.page ?? 1,
    }),
});

export const createCategory = defineTool({
  name: "wp_create_category",
  title: "Create a category",
  description:
    "Create a category and return its ID, ready to pass to wp_create_post. Check wp_list_categories first: WordPress will happily create a near-duplicate of an existing category with a suffixed slug, which is how a site ends up with both 'marketing' and 'marketing-2' and posts split between them.",
  schema: {
    name: z.string().describe("The category name, as displayed."),
    slug: z.string().optional().describe("URL slug. Derived from the name when empty."),
    parent: z.number().int().optional().describe("Category ID to nest this one under."),
    description: z.string().optional().describe("Description, which some themes show on the category archive page."),
    ...siteArg,
  },
  risk: "write",
  surface: "core",
  summary: (args) => `create the category "${snippet(args.name)}"`,
  handler: async (args, ctx) =>
    ctx.client(args.site).post("categories", definedFields(args, ["name", "slug", "parent", "description"])),
});

export const listTags = defineTool({
  name: "wp_list_tags",
  title: "List tags",
  description:
    "List the site's tags with their IDs, slugs and post counts. As with categories, posts take tag IDs rather than names. Tags are flat, so there is no parent to filter on.",
  schema: {
    search: termListArgs.search,
    slug: termListArgs.slug,
    hide_empty: termListArgs.hide_empty,
    orderby: termListArgs.orderby,
    order: termListArgs.order,
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get("tags", {
      search: args.search,
      slug: args.slug,
      hide_empty: args.hide_empty,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 100,
      page: args.page ?? 1,
    }),
});

export const createTag = defineTool({
  name: "wp_create_tag",
  title: "Create a tag",
  description:
    "Create a tag and return its ID, ready to pass to wp_create_post. Check wp_list_tags first, since a near-duplicate tag is created without complaint and splits the archive.",
  schema: {
    name: z.string().describe("The tag name, as displayed."),
    slug: z.string().optional().describe("URL slug. Derived from the name when empty."),
    description: z.string().optional().describe("Description, shown on the tag archive by some themes."),
    ...siteArg,
  },
  risk: "write",
  surface: "core",
  summary: (args) => `create the tag "${snippet(args.name)}"`,
  handler: async (args, ctx) =>
    ctx.client(args.site).post("tags", definedFields(args, ["name", "slug", "description"])),
});

export const listTaxonomies = defineTool({
  name: "wp_list_taxonomies",
  title: "List every registered taxonomy",
  description:
    "List every taxonomy registered on the site, built in and custom, with the REST base each one answers on and the post types it applies to. The REST base is the important field: it is what wp_list_taxonomy_terms takes, and it frequently differs from the taxonomy slug, so a name read off wp-admin will not work. Only taxonomies registered with show_in_rest appear here, and one that is missing is not reachable over the API at all.",
  schema: { ...siteArg },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => {
    const raw = (await ctx.client(args.site).get("taxonomies", { context: "edit" })) as Record<
      string,
      { name?: string; slug?: string; rest_base?: string; types?: string[]; hierarchical?: boolean }
    >;
    return Object.fromEntries(
      Object.entries(raw ?? {}).map(([key, value]) => [
        key,
        {
          name: value?.name,
          slug: value?.slug,
          rest_base: value?.rest_base,
          types: value?.types,
          hierarchical: value?.hierarchical,
        },
      ]),
    );
  },
});

export const listTaxonomyTerms = defineTool({
  name: "wp_list_taxonomy_terms",
  title: "List terms in any taxonomy",
  description:
    "List the terms in any taxonomy, custom or built in, by its REST base. Get the REST base from wp_list_taxonomies rather than guessing it from the name shown in wp-admin, since the two often differ. For categories and tags the dedicated tools are simpler.",
  schema: {
    taxonomy: z
      .string()
      .describe(
        "REST base of the taxonomy, from wp_list_taxonomies. For example categories, tags, or a custom one such as product_cat.",
      ),
    ...termListArgs,
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get(args.taxonomy, {
      search: args.search,
      slug: args.slug,
      parent: args.parent,
      hide_empty: args.hide_empty,
      orderby: args.orderby,
      order: args.order,
      per_page: args.per_page ?? 100,
      page: args.page ?? 1,
    }),
});

export const TAXONOMY_TOOLS = [
  listCategories,
  createCategory,
  listTags,
  createTag,
  listTaxonomies,
  listTaxonomyTerms,
];
