/**
 * Shared plumbing every tool uses.
 *
 * Registering forty-two tools by hand is forty-two chances to forget an
 * annotation, leak a stack trace, or skip the guard on something that publishes.
 * This wraps all of that once so a tool module only describes what it does.
 *
 * Two pieces of real logic live here.
 *
 * `risk` can be a function of the arguments rather than a fixed level, because
 * in WordPress the same tool is harmless or irreversible depending on what it
 * is passed. `wp_update_post` saving a draft is an ordinary write; the same
 * call with `status: "publish"` puts the post in front of an RSS reader and a
 * mailing list. A fixed level would either confirm every draft edit or confirm
 * nothing that matters.
 *
 * `ctx.client` resolves the site per call rather than at startup, which is what
 * lets the same tool list serve a local install reading several sites from the
 * environment and a hosted one holding one site's credentials per request.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import { HelperPluginMissingError, WordPressError, WriteBlockedError } from "../api/errors.js";
import type { WpClient } from "../api/client.js";
import { selectSite, type Config, type Site } from "../config.js";
import { annotationsFor, type Risk, type Surface, type WriteGuard } from "../safety.js";

export type ToolContext = {
  config: Config;
  guard: WriteGuard;
  /** The site a call acts on, resolved from the optional `site` argument. */
  site: (hint?: string) => Site;
  /** A client bound to that site. */
  client: (hint?: string) => WpClient;
};

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function ok(data: unknown): ToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/**
 * Errors come back as a normal result with `isError`, not a thrown exception.
 *
 * A thrown MCP error reaches the model as a protocol failure with no structure,
 * which throws away every actionable message in `api/errors.ts`. A result it can
 * read is the difference between a correct retry and a give-up.
 */
export function fail(error: unknown): ToolResult {
  const payload =
    error instanceof WordPressError ||
    error instanceof WriteBlockedError ||
    error instanceof HelperPluginMissingError
      ? error.toJSON()
      : { error: (error as Error)?.message ?? String(error) };
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], isError: true };
}

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

/** The confirmation argument, on tools that publish or cannot be undone. */
export const confirmArg = {
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Must be true for an action that publishes or cannot be undone. The tool says which of its arguments make it one, and returns what it was about to do if this is missing.",
    ),
};

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

export type ToolSpec<S extends ZodRawShape> = {
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

export function defineTool<S extends ZodRawShape>(spec: ToolSpec<S>): ToolSpec<S> {
  return spec;
}

/**
 * A tool of any shape, for the one place tools are collected into a list.
 *
 * `ToolSpec` is generic over its schema, so a list of tools with different
 * schemas has no single type: each handler takes a different argument shape and
 * function parameters are contravariant. The checking that matters happens
 * inside each `defineTool` call, where schema and handler are proved against
 * each other. This only loosens the seam where they are gathered.
 */
export type AnyToolSpec = Omit<ToolSpec<ZodRawShape>, "handler" | "summary" | "risk"> & {
  risk: Risk | ((args: never) => Risk);
  handler: (args: never, ctx: ToolContext) => Promise<unknown>;
  summary?: (args: never) => string;
};

/** The worst level a tool can reach, for the annotations, which cannot see arguments. */
export function declaredRisk(spec: AnyToolSpec): Risk {
  return typeof spec.risk === "function" ? "destructive" : spec.risk;
}

/** Register one tool against a server, with guarding and error handling. */
export function register(
  server: McpServer,
  contextFor: (extra: unknown) => ToolContext,
  spec: AnyToolSpec,
): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.schema,
      annotations: {
        title: spec.title,
        ...annotationsFor(declaredRisk(spec), { idempotent: spec.idempotent }),
      },
    },
    // The SDK derives its callback type from the schema generic. This wrapper is
    // generic over the same shape, but TypeScript cannot prove the two equal
    // through the indirection, so the cast lives at this single boundary rather
    // than in every tool definition.
    (async (args: Record<string, unknown>, extra: unknown) => {
      try {
        const ctx = contextFor(extra);
        const risk = typeof spec.risk === "function" ? spec.risk(args as never) : spec.risk;
        if (risk !== "read") {
          const summary = spec.summary?.(args as never) ?? spec.name;
          const confirm = (args as { confirm?: boolean }).confirm;
          ctx.guard.check(spec.name, risk, confirm, summary);
        }
        return ok(await spec.handler(args as never, ctx));
      } catch (error) {
        return fail(error);
      }
    }) as never,
  );
}

/**
 * Build the context a tool handler runs against.
 *
 * The MCP path and the CLI path both need one, and they differ only in where
 * the guard comes from: the server builds its own, while the CLI builds one
 * with `surface: "cli"` so a refusal names `--confirm` rather than
 * `confirm: true`. Assembling it here rather than in `server.ts` is what stops
 * the two surfaces drifting into two ideas of what a tool can reach.
 *
 * A client factory rather than a client, because "which site" is part of the
 * address in WordPress and is not known until a call names one. Clients are
 * cached per site name, since building one is cheap but doing it inside a loop
 * over forty posts is noise.
 */
export function makeContext(
  createClient: (site: Site) => WpClient,
  config: Config,
  guard: WriteGuard,
): ToolContext {
  const clients = new Map<string, WpClient>();
  const site = (hint?: string): Site => selectSite(config, hint);

  return {
    config,
    guard,
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
