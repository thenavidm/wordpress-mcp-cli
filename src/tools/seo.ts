/**
 * Rank Math: the SEO fields on a post, and the site's redirects.
 *
 * Everything here goes through the helper plugin, for a reason worth stating.
 * Rank Math stores its settings in post meta keys prefixed with an underscore,
 * which WordPress treats as protected and refuses to expose or accept over the
 * core REST API. There is no argument to core that reaches them. The plugin
 * registers routes that read and write exactly the known Rank Math keys, which
 * is narrower and safer than opening protected meta in general.
 *
 * Redirects are not meta at all. Rank Math keeps them in its own database
 * table, so they are reachable only through code running inside WordPress.
 */

import { z } from "zod";
import { confirmArg, defineTool, definedFields, pageArgs, siteArg, snippet } from "./kit.js";

export const getRankMath = defineTool({
  name: "wp_get_rankmath",
  title: "Read Rank Math SEO settings for a post",
  description:
    "Read every Rank Math field set on a post or page: SEO title, meta description, focus keywords, robots directives, canonical URL, the Open Graph and Twitter overrides, schema type, pillar-content flag, primary category and breadcrumb title, along with the stored SEO score. Fields that were never set are omitted rather than returned empty, so what comes back is what Rank Math will actually use. Needs the helper plugin, and Rank Math active on the site.",
  schema: {
    post_id: z.number().int().describe("The post or page ID."),
    ...siteArg,
  },
  risk: "read",
  surface: "helper",
  handler: async (args, ctx) =>
    ctx.client(args.site).helperGet(`rankmath/${args.post_id}`, {}, "wp_get_rankmath"),
});

export const updateRankMath = defineTool({
  name: "wp_update_rankmath",
  title: "Update Rank Math SEO settings for a post",
  description:
    "Update Rank Math fields on a post or page. Only the fields passed are touched, and passing an empty string clears a field rather than storing a blank. The SEO title and description accept Rank Math's variables, so %title% %sep% %sitename% resolves at render time and stays correct if the site name changes, which is usually better than hardcoding. Changing the canonical URL or setting robots to noindex affects how search engines treat the page, so those are worth being deliberate about. Needs the helper plugin, and Rank Math active.",
  schema: {
    post_id: z.number().int().describe("The post or page ID."),
    rank_math_title: z
      .string()
      .optional()
      .describe(
        "SEO title, shown in search results. Supports Rank Math variables such as %title%, %sep% and %sitename%. Aim for under about 60 characters so it is not truncated.",
      ),
    rank_math_description: z
      .string()
      .optional()
      .describe(
        "Meta description, the snippet under the title in search results. Supports the same variables. Aim for roughly 150 to 160 characters.",
      ),
    rank_math_focus_keyword: z
      .string()
      .optional()
      .describe("Focus keyword, or several comma-separated. The first is the primary one Rank Math scores against."),
    rank_math_robots: z
      .string()
      .optional()
      .describe(
        "Robots directives, comma-separated: index, noindex, nofollow, noarchive, noimageindex, nosnippet. Setting noindex removes the page from search results once crawlers revisit.",
      ),
    rank_math_canonical_url: z
      .string()
      .optional()
      .describe(
        "Canonical URL override, naming another page as the authoritative version of this one. Pointing this at the wrong URL de-indexes the page, so leave it empty unless the content genuinely duplicates something.",
      ),
    rank_math_og_title: z.string().optional().describe("Open Graph title, used by Facebook and LinkedIn."),
    rank_math_og_description: z.string().optional().describe("Open Graph description."),
    rank_math_og_image: z.string().optional().describe("Open Graph image URL. Use a full URL, not an attachment ID."),
    rank_math_twitter_title: z.string().optional().describe("Twitter card title."),
    rank_math_twitter_description: z.string().optional().describe("Twitter card description."),
    rank_math_twitter_image: z.string().optional().describe("Twitter card image URL."),
    rank_math_pillar_content: z
      .string()
      .optional()
      .describe("Mark as pillar content, which Rank Math uses when suggesting internal links. Pass 'on' to set it."),
    rank_math_primary_category: z
      .string()
      .optional()
      .describe("Category ID to treat as primary, used in breadcrumbs and permalinks."),
    rank_math_breadcrumb_title: z.string().optional().describe("Override the title shown in breadcrumb trails."),
    ...siteArg,
  },
  risk: "write",
  surface: "helper",
  idempotent: true,
  summary: (args) => `update Rank Math SEO fields on post ${args.post_id}`,
  handler: async (args, ctx) => {
    const body = definedFields(args, [
      "rank_math_title",
      "rank_math_description",
      "rank_math_focus_keyword",
      "rank_math_robots",
      "rank_math_canonical_url",
      "rank_math_og_title",
      "rank_math_og_description",
      "rank_math_og_image",
      "rank_math_twitter_title",
      "rank_math_twitter_description",
      "rank_math_twitter_image",
      "rank_math_pillar_content",
      "rank_math_primary_category",
      "rank_math_breadcrumb_title",
    ]);
    return ctx.client(args.site).helperPost(`rankmath/${args.post_id}`, body, "wp_update_rankmath");
  },
});

export const listRedirects = defineTool({
  name: "wp_list_redirects",
  title: "List redirects",
  description:
    "List the site's redirects with their IDs, sources, destinations and HTTP status codes. Search matches both the source and the destination, which is how to check whether a URL is already redirected before adding another rule for it. Needs the helper plugin, and Rank Math's Redirections module switched on, since the rules live in its own database table.",
  schema: {
    search: z.string().optional().describe("Search across source and destination URLs."),
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "helper",
  handler: async (args, ctx) =>
    ctx.client(args.site).helperGet(
      "redirects",
      { search: args.search, per_page: args.per_page ?? 50, page: args.page ?? 1 },
      "wp_list_redirects",
    ),
});

export const createRedirect = defineTool({
  name: "wp_create_redirect",
  title: "Create a redirect",
  description:
    "Create a redirect from one path to another. Use 301 for a permanent move, which passes search ranking to the destination and is cached hard by browsers, and 302 when the change is temporary. Check wp_list_redirects first: a second rule for a source that already has one is how a redirect loop gets built. A chain, where A redirects to B and B to C, costs ranking and should be flattened to point A straight at C.",
  schema: {
    source: z
      .string()
      .describe("The path to redirect from, relative to the site root, such as /old-page. A full URL also works."),
    destination: z
      .string()
      .describe("Where to send it: a path such as /new-page, or a full URL on another domain."),
    type: z
      .number()
      .int()
      .optional()
      .describe(
        "HTTP status: 301 permanent (the default, and cached aggressively by browsers), 302 temporary, 307 temporary preserving the method, 410 gone, 451 unavailable for legal reasons.",
      ),
    ...siteArg,
  },
  risk: "write",
  surface: "helper",
  summary: (args) => `redirect ${snippet(args.source)} to ${snippet(args.destination)}`,
  handler: async (args, ctx) =>
    ctx
      .client(args.site)
      .helperPost("redirects", definedFields(args, ["source", "destination", "type"]), "wp_create_redirect"),
});

export const deleteRedirect = defineTool({
  name: "wp_delete_redirect",
  title: "Delete a redirect",
  description:
    "Delete a redirect by ID, from wp_list_redirects. The rule is removed from Rank Math's table with no trash step, so the old URL starts returning a 404 again as soon as caches clear. On a URL that has been redirected for a while, that means losing whatever ranking and inbound links the redirect was carrying.",
  schema: {
    redirect_id: z.number().int().describe("The redirect ID, from wp_list_redirects."),
    ...siteArg,
    ...confirmArg,
  },
  risk: "destructive",
  surface: "helper",
  summary: (args) => `delete redirect ${args.redirect_id}, so its source URL returns a 404 again`,
  handler: async (args, ctx) =>
    ctx.client(args.site).helperDelete(`redirects/${args.redirect_id}`, "wp_delete_redirect"),
});

export const SEO_TOOLS = [getRankMath, updateRankMath, listRedirects, createRedirect, deleteRedirect];
