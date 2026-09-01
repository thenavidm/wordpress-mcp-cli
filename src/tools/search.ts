/**
 * One search across everything the site exposes.
 *
 * WordPress's search endpoint returns a thin result: an ID, a title, a URL, a
 * type and a subtype, and nothing else. That is a feature when the question is
 * "does this site have a page about X and what is its ID", which is what this
 * is for. When the answer needs the content, follow it with wp_get_post or
 * wp_get_custom on the IDs it returns.
 */

import { z } from "zod";
import { defineTool, pageArgs, siteArg } from "./kit.js";

export const search = defineTool({
  name: "wp_search",
  title: "Search across all content on the site",
  description:
    "Search every searchable post type and term at once, returning IDs, titles, URLs and types. This is the fastest way to find something when the post type is unknown, and the right first call when resolving a vague reference to a real ID. Results are deliberately thin: fetch the ones that matter with wp_get_post or wp_get_custom. Only published content is searchable, so a draft will not appear here even though wp_list_posts can find it.",
  schema: {
    search: z.string().describe("What to search for."),
    type: z
      .enum(["post", "term", "post-format"])
      .optional()
      .describe("Narrow to content (post), taxonomy terms (term), or post formats. Defaults to post."),
    subtype: z
      .string()
      .optional()
      .describe(
        "Narrow further within the type, by REST base. For example `page` to search only pages, or a custom post type's base. Defaults to any.",
      ),
    ...pageArgs,
    ...siteArg,
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) =>
    ctx.client(args.site).get("search", {
      search: args.search,
      type: args.type,
      subtype: args.subtype,
      per_page: args.per_page ?? 10,
      page: args.page ?? 1,
    }),
});

export const SEARCH_TOOLS = [search];
