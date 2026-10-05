/**
 * Shared plumbing every tool uses, now on Slipway.
 *
 * Tool modules keep describing themselves with a Zod shape, a risk and a
 * handler. This adapter turns each into a Slipway tool, so the MCP server, the
 * CLI, the write guard, annotations and errors all come from the framework
 * instead of a copy kept in this repo.
 *
 * `risk` can still be a function of the arguments, because in WordPress the
 * same tool is harmless or irreversible depending on what it is passed.
 * `wp_update_post` saving a draft is an ordinary write; the same call with
 * `status: "publish"` puts the post in front of an RSS reader and a mailing
 * list. Such a tool tells clients its highest level, destructive, and Slipway's
 * `riskFor` decides each call, so only the publishing call needs approval.
 *
 * `ctx.client` resolves the site per call rather than at startup, which is what
 * lets the same tool list serve a local install reading several sites from the
 * environment and a hosted one holding one site's credentials per request.
 */

import { ApiError, NotConfiguredError, RateLimitError, SlipwayError, TimeoutError, httpError, toolkit, z, type Risk, type Tool } from "@thenavidm/slipway";
import type { WpClient } from "../api/client.js";
import { HelperPluginMissingError, WordPressError } from "../api/errors.js";
import { selectSite, type Config, type Site } from "../config.js";

/** Which API a tool reaches. It is also the tool's toolset, so `WORDPRESS_TOOLSETS=core` leaves out the helper's twelve. */
export type Surface =
  /** WordPress core, `wp/v2`. Present on every modern install. */
  | "core"
  /** The helper plugin in this repo, `wordpress-mcp/v1`. */
  | "helper";

export type ToolContext = {
  config: Config;
  /** The site a call acts on, resolved from the optional `site` argument. */
  site: (hint?: string) => Site;
  /** A client bound to that site. */
  client: (hint?: string) => WpClient;
};

const kit = toolkit<ToolContext>();

/**
 * The `site` argument, on every tool.
 *
 * Optional rather than required because most people run one site and being made
 * to name it on every call is friction for no gain. With several configured and
 * no default set, `selectSite` refuses instead of guessing.
 */
export const siteArg = {
  site: z
    .string()
    .optional()
    .describe(
      "Which configured WordPress site to act on, by its short name or its URL. Only needed when more than one is configured and no default is set. Call wp_list_sites to see them.",
    ),
};

/**
 * Kept so tool modules read the same, but never sent: Slipway adds `confirm`
 * to every tool that can publish or destroy, with one description everywhere.
 */
export const confirmArg = {
  confirm: z.boolean().optional(),
};

/** Page size and page number, on every paginating tool. */
export const pageArgs = {
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("How many to return per page, 1-100. WordPress caps this at 100. Defaults to 10."),
  page: z.number().int().min(1).optional().describe("Which page of results, starting at 1."),
};

type Shape = Record<string, z.ZodType>;

export type ToolSpec<S extends Shape> = {
  name: string;
  /** One line, imperative. Shown in tool pickers. */
  title: string;
  description: string;
  schema: S;
  /** A level, or a function of the arguments when the same call can be either. */
  risk: Risk | ((args: z.infer<z.ZodObject<S>>) => Risk);
  surface: Surface;
  /** True when calling twice has the same effect as calling once. */
  idempotent?: boolean;
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
  /** One line for the audit log and the confirm message, when this writes. */
  summary?: (args: z.infer<z.ZodObject<S>>) => string;
};

export type AnyToolSpec = Tool<ToolContext>;

/** Rank Math switched off, or its redirections module, is the site to set up, as the helper plugin is. */
const SETUP_CODES = new Set(["plugin_not_active", "no_redirects_table"]);

/**
 * The site's status picks the exit code: 401 and 403 (an application password
 * without the role for it) are 4, a missing route or post is 3, 400 is 2 and
 * the rest 5. A rate limit is 7 whatever the status, read from the words as
 * 1.1 did, since a security plugin may refuse with a 403 or a 503. A missing
 * helper plugin, Rank Math or its redirections module is something to set up,
 * not to retry, so it exits 10. WordPress's own error code, the site and the
 * endpoint ride along in `details`.
 */
export function toSlipway(error: WordPressError | HelperPluginMissingError): SlipwayError {
  if (error instanceof HelperPluginMissingError) {
    return new NotConfiguredError(error.message, { details: { site: error.site, reason: "helper_plugin_missing" }, cause: error });
  }
  const options = {
    ...(error.status ? { status: error.status } : {}),
    details: { reason: error.code, site: error.site, endpoint: error.endpoint, ...(error.detail ? { detail: error.detail } : {}) },
    cause: error,
  };
  if (error.status === 429 || /rate ?limit/i.test(`${error.code} ${error.message}`)) return new RateLimitError(error.message, options);
  if (SETUP_CODES.has(error.code)) return new NotConfiguredError(error.message, options);
  // Status 0 is a request the site never answered: a timeout, DNS, a refused connection.
  if (error.code === "timeout") return new TimeoutError(error.message, options);
  return error.status ? httpError(error.status, error.message, options) : new ApiError(error.message, options);
}

export function defineTool<S extends Shape>(spec: ToolSpec<S>): Tool<ToolContext> {
  const { confirm: _confirm, ...shape } = spec.schema as Shape;
  const handler = spec.handler as (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  const riskFor = typeof spec.risk === "function" ? (spec.risk as (args: Record<string, unknown>) => Risk) : undefined;
  return kit.defineTool({
    name: spec.name,
    title: spec.title,
    description: spec.description,
    input: z.object(shape),
    // What clients see is the highest a call can be; riskFor decides each call.
    risk: riskFor ? "destructive" : (spec.risk as Risk),
    ...(riskFor ? { riskFor } : {}),
    tags: [spec.surface],
    ...(spec.idempotent !== undefined ? { idempotent: spec.idempotent } : {}),
    ...(spec.summary ? { summary: spec.summary as (args: Record<string, unknown>) => string } : {}),
    handler: async (args, ctx) => {
      try {
        return await handler(args, ctx);
      } catch (error) {
        throw error instanceof WordPressError || error instanceof HelperPluginMissingError ? toSlipway(error) : error;
      }
    },
  });
}

export function makeContext(createClient: (site: Site) => WpClient, config: Config): ToolContext {
  const clients = new Map<string, WpClient>();
  const site = (hint?: string): Site => selectSite(config, hint);
  return {
    config,
    site,
    client: (hint?: string) => {
      const resolved = site(hint);
      const existing = clients.get(resolved.name);
      if (existing) return existing;
      const created = createClient(resolved);
      clients.set(resolved.name, created);
      return created;
    },
  };
}

/** Copy only the arguments a caller actually set, so a PATCH does not blank fields. */
export function definedFields(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Trim a value to one readable line for the audit log and the confirm message. */
export function snippet(text: string | undefined, length = 60): string {
  if (!text) return "";
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

/** Name the site in a confirm message, since the whole risk is acting on the wrong one. */
export function on(ctx: ToolContext, hint?: string): string {
  try {
    return ctx.site(hint).name;
  } catch {
    return "the configured site";
  }
}
