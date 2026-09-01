/**
 * Every tool, in the order they should appear in a client's tool list.
 *
 * Ordered by how a person actually works through a site: find out what is
 * there, then posts and pages, then the things attached to them, then the
 * groups that need the helper plugin. A client showing the list truncated
 * should show the useful half.
 */

import { SITE_TOOLS } from "./sites.js";
import { SEARCH_TOOLS } from "./search.js";
import { POST_TOOLS } from "./posts.js";
import { PAGE_TOOLS } from "./pages.js";
import { CUSTOM_TOOLS } from "./custom.js";
import { MEDIA_TOOLS } from "./media.js";
import { TAXONOMY_TOOLS } from "./taxonomies.js";
import { PEOPLE_TOOLS } from "./people.js";
import { META_TOOLS } from "./meta.js";
import { BUILDER_TOOLS } from "./builder.js";
import { SEO_TOOLS } from "./seo.js";
import { BULK_TOOLS } from "./bulk.js";
import type { AnyToolSpec } from "./kit.js";

export const ALL_TOOLS = [
  ...SITE_TOOLS,
  ...SEARCH_TOOLS,
  ...POST_TOOLS,
  ...PAGE_TOOLS,
  ...CUSTOM_TOOLS,
  ...MEDIA_TOOLS,
  ...TAXONOMY_TOOLS,
  ...PEOPLE_TOOLS,
  ...META_TOOLS,
  ...BUILDER_TOOLS,
  ...SEO_TOOLS,
  ...BULK_TOOLS,
] as unknown as AnyToolSpec[];

export { SITE_TOOLS, SEARCH_TOOLS, POST_TOOLS, PAGE_TOOLS, CUSTOM_TOOLS, MEDIA_TOOLS };
export { TAXONOMY_TOOLS, PEOPLE_TOOLS, META_TOOLS, BUILDER_TOOLS, SEO_TOOLS, BULK_TOOLS };
export type { AnyToolSpec, ToolContext } from "./kit.js";
