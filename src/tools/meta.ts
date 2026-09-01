/**
 * Post meta, including the fields core will not show you.
 *
 * WordPress hides two kinds of meta from the REST API. Anything with a leading
 * underscore is "protected" and is never exposed or accepted, and anything not
 * registered with `show_in_rest` is invisible even without the underscore.
 * Between them that covers most of what plugins actually store: ACF fields,
 * Elementor's layout, SEO settings, page-builder state.
 *
 * So the `meta` argument on the post tools reaches a small, curated subset, and
 * these two tools reach the rest through the helper plugin. That is a real
 * capability increase over the core API, which is why the write is deliberate
 * about what it will do.
 */

import { z } from "zod";
import { defineTool, siteArg } from "./kit.js";

export const getAllMeta = defineTool({
  name: "wp_get_all_meta",
  title: "Read every meta field on a post",
  description:
    "Read every meta field stored on a post, page or custom post type item, including the underscore-prefixed fields WordPress hides from the core REST API. This is where ACF field values, Elementor layout data, SEO settings and page-builder state actually live, so it is the tool that answers 'why does this page look like that' when the post content explains nothing. Needs the helper plugin.",
  schema: {
    post_id: z.number().int().describe("The post, page or item ID."),
    ...siteArg,
  },
  risk: "read",
  surface: "helper",
  handler: async (args, ctx) =>
    ctx.client(args.site).helperGet(`meta/${args.post_id}`, {}, "wp_get_all_meta"),
});

export const updateMeta = defineTool({
  name: "wp_update_meta",
  title: "Write meta fields on a post",
  description:
    "Write meta fields on a post, page or item, including protected underscore-prefixed keys that the core REST API refuses. Only the keys passed are touched; everything else is left alone. Read the post with wp_get_all_meta first to learn the exact key names, because a plugin reading a key that does not exist falls back to its default silently rather than erroring, so a typo looks like the write did nothing. Needs the helper plugin.",
  schema: {
    post_id: z.number().int().describe("The post, page or item ID."),
    meta: z
      .record(z.string(), z.any())
      .describe(
        "Key-value pairs to write. Keys must match exactly what the plugin reads, including any leading underscore. Get them from wp_get_all_meta rather than guessing.",
      ),
    ...siteArg,
  },
  risk: "write",
  surface: "helper",
  idempotent: true,
  summary: (args) =>
    `write meta fields ${Object.keys(args.meta ?? {}).join(", ")} on post ${args.post_id}`,
  handler: async (args, ctx) =>
    ctx.client(args.site).helperPost(`meta/${args.post_id}`, { meta: args.meta }, "wp_update_meta"),
});

export const META_TOOLS = [getAllMeta, updateMeta];
