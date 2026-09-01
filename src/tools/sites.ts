/**
 * Which sites this server can reach, and what it is allowed to do on them.
 *
 * `wp_list_sites` is the tool to call first on an unfamiliar setup. It answers
 * the three questions that otherwise get discovered through failures: which
 * sites exist, which user each one acts as, and whether the helper plugin is
 * installed there, since twelve of the tools need it and thirty do not.
 */

import { z } from "zod";
import { defineTool, siteArg } from "./kit.js";

export const listSites = defineTool({
  name: "wp_list_sites",
  title: "List the configured WordPress sites",
  description:
    "List every WordPress site this server can reach, with the short name to pass as `site`, the URL, the user it acts as, and optionally whether the helper plugin is installed there. Call this first on an unfamiliar setup: it is the only way to learn the site names, and it tells you up front whether the Elementor, Rank Math, redirect, meta and bulk tools will work, rather than finding out when one fails.",
  schema: {
    check_plugin: z
      .boolean()
      .optional()
      .describe(
        "Contact each site to check whether the helper plugin is installed. Costs one request per site, so it is off by default.",
      ),
  },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => {
    const sites = await Promise.all(
      ctx.config.sites.map(async (site) => {
        const base = {
          name: site.name,
          url: site.url,
          username: site.username,
          is_default:
            ctx.config.defaultSite === site.name ||
            (ctx.config.sites.length === 1 && !ctx.config.defaultSite),
        };
        if (!args.check_plugin) return base;
        const helper = await ctx
          .client(site.name)
          .hasHelperPlugin()
          .catch(() => false);
        return { ...base, helper_plugin: helper };
      }),
    );

    return {
      sites,
      count: sites.length,
      read_only: ctx.config.readOnly,
      ...(sites.length > 1 && !ctx.config.defaultSite
        ? {
            note: "More than one site is configured and no default is set, so every tool call has to name one with `site`.",
          }
        : {}),
    };
  },
});

export const getMe = defineTool({
  name: "wp_get_me",
  title: "Show the WordPress user this connector acts as",
  description:
    "Show the WordPress user the application password belongs to, including the role and the capabilities that come with it. Worth checking before diagnosing a permission failure: an application password carries its owner's own role, so an Author account can only reach its own posts no matter what is asked of it.",
  schema: { ...siteArg },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => ctx.client(args.site).get("users/me", { context: "edit" }),
});

export const getSettings = defineTool({
  name: "wp_get_settings",
  title: "Read the site's general settings",
  description:
    "Read the site's general settings: title, tagline, URL, admin email, timezone, date and time formats, start of week, language, and the default post category and format. The timezone is the one worth reading before scheduling anything, because a date passed to wp_create_post is interpreted in the site's timezone rather than yours. Requires an Administrator account.",
  schema: { ...siteArg },
  risk: "read",
  surface: "core",
  handler: async (args, ctx) => ctx.client(args.site).get("settings"),
});

export const SITE_TOOLS = [listSites, getMe, getSettings];
