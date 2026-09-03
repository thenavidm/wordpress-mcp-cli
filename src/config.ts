/**
 * Resolving credentials, and the multi-site model.
 *
 * WordPress has no concept of an account that spans installs. Every site is its
 * own database with its own users, so "which site" is not a preference here, it
 * is part of the address. A server bound to one install would mean restarting it
 * to move between a blog and a client site, so every tool takes an optional
 * `site` and the one that acts when none is named is chosen deliberately.
 *
 * Three sources, in priority order:
 *   1. WORDPRESS_SITES      JSON array, the readable form
 *   2. WP_SITES             pipe-delimited, kept because existing configs use it
 *   3. WORDPRESS_SITE_URL + _USERNAME + _APP_PASSWORD, the single-site variables
 *
 * `configFromSites` exists for the hosted case, where credentials arrive per
 * request from a connector rather than from the environment. That is the whole
 * reason the tools take a config rather than reading `process.env` themselves.
 */

export type Site = {
  /** Short label a tool's `site` argument matches, e.g. "blog". */
  name: string;
  /** Origin with no trailing slash, e.g. https://example.com */
  url: string;
  username: string;
  /**
   * An application password from Users > Profile > Application Passwords.
   * WordPress displays it in space-separated groups and accepts it either way,
   * so the spaces are preserved rather than stripped: a user pasting exactly
   * what WordPress showed them should work.
   */
  appPassword: string;
};

export type Config = {
  sites: Site[];
  /** Which site acts when a tool names none. Empty means "the only one". */
  defaultSite?: string;
  readOnly: boolean;
  allowDestructive: boolean;
  requestTimeoutMs: number;
  maxRetries: number;
  userAgent: string;
  auditPath?: string;
};

export const DEFAULT_TIMEOUT_MS = 30_000;
export const USER_AGENT = "wordpress-mcp (+https://github.com/thenavidm/wordpress-mcp-cli)";

/** Trim, force a scheme, drop any trailing slash. */
export function normalizeSiteUrl(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * A stable short name for a site that did not supply one.
 *
 * The host with the public suffix and any `www.` removed, which is what a
 * person would call it. Collisions are resolved by the caller, since two
 * installs on the same host is a real setup (a subdirectory multisite).
 */
export function siteNameFromUrl(url: string): string {
  try {
    const host = new URL(normalizeSiteUrl(url)).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.toLowerCase();
  } catch {
    return "site";
  }
}

// The environment is passed in rather than read from `process.env` directly, so
// that `loadConfig` is a pure function of its argument and the safety switches
// are actually testable. Reading the global here meant WORDPRESS_READ_ONLY was
// silently ignored whenever a caller supplied its own environment.
function envFlag(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function envInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    process.stderr.write(
      `[wordpress-mcp] ${name}="${raw}" is not a positive number. Using ${fallback}.\n`,
    );
    return fallback;
  }
  return n;
}

/** Drop sites missing anything required, and make the names unique. */
function normalizeSites(raw: Array<Partial<Site>>): Site[] {
  const out: Site[] = [];
  const taken = new Set<string>();
  for (const entry of raw) {
    const url = normalizeSiteUrl(entry.url ?? "");
    const username = (entry.username ?? "").trim();
    const appPassword = (entry.appPassword ?? "").trim();
    if (!url || !username || !appPassword) continue;

    let name = (entry.name ?? "").trim().toLowerCase() || siteNameFromUrl(url);
    if (taken.has(name)) {
      let n = 2;
      while (taken.has(`${name}-${n}`)) n += 1;
      name = `${name}-${n}`;
    }
    taken.add(name);
    out.push({ name, url, username, appPassword });
  }
  return out;
}

/**
 * The pipe-delimited form: `name|url|username|app password`, comma-separated.
 *
 * Kept because it is what existing client configs hold, and silently dropping
 * it would look like the credentials stopped working. An application password
 * cannot contain a pipe, so the last field is rejoined rather than truncated
 * only to be defensive about a hand-edited value.
 */
function parsePipeSites(raw: string): Array<Partial<Site>> {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url, username, ...rest] = entry.split("|");
      return {
        name: name ?? "",
        url: url ?? "",
        username: username ?? "",
        appPassword: rest.join("|"),
      };
    });
}

function parseJsonSites(raw: string): Array<Partial<Site>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stderr.write(
      "[wordpress-mcp] WORDPRESS_SITES is not valid JSON. Expected an array like " +
        '[{"name":"blog","url":"https://example.com","username":"you","app_password":"xxxx xxxx"}]\n',
    );
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      name: String(r.name ?? ""),
      url: String(r.url ?? r.site_url ?? ""),
      username: String(r.username ?? r.user ?? ""),
      appPassword: String(r.app_password ?? r.appPassword ?? r.password ?? ""),
    };
  });
}

/** Build a config directly, for a host that holds credentials of its own. */
export function configFromSites(
  sites: Array<Partial<Site>>,
  options: Partial<Omit<Config, "sites">> = {},
): Config {
  return {
    sites: normalizeSites(sites),
    defaultSite: options.defaultSite,
    readOnly: options.readOnly ?? false,
    allowDestructive: options.allowDestructive ?? true,
    requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? 2,
    userAgent: options.userAgent ?? USER_AGENT,
    auditPath: options.auditPath,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw: Array<Partial<Site>> = [];

  if (env.WORDPRESS_SITES?.trim()) raw.push(...parseJsonSites(env.WORDPRESS_SITES));
  if (env.WP_SITES?.trim()) raw.push(...parsePipeSites(env.WP_SITES));

  const singleUrl = env.WORDPRESS_SITE_URL ?? env.WP_SITE_URL;
  if (singleUrl?.trim()) {
    raw.push({
      name: env.WORDPRESS_SITE_NAME ?? "",
      url: singleUrl,
      username: env.WORDPRESS_USERNAME ?? env.WP_USERNAME ?? "",
      appPassword: env.WORDPRESS_APP_PASSWORD ?? env.WP_APP_PASSWORD ?? "",
    });
  }

  return {
    sites: normalizeSites(raw),
    defaultSite: (env.WORDPRESS_DEFAULT_SITE ?? "").trim().toLowerCase() || undefined,
    readOnly: envFlag(env, "WORDPRESS_READ_ONLY", false),
    allowDestructive: envFlag(env, "WORDPRESS_ALLOW_DESTRUCTIVE", true),
    requestTimeoutMs: envInt(env, "WORDPRESS_REQUEST_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    maxRetries: envInt(env, "WORDPRESS_MAX_RETRIES", 2),
    userAgent: env.WORDPRESS_USER_AGENT?.trim() || USER_AGENT,
    auditPath: env.WORDPRESS_AUDIT_LOG?.trim() || undefined,
  };
}

/**
 * Pick the site a call acts on.
 *
 * Named site wins. Then WORDPRESS_DEFAULT_SITE. Then, only when exactly one is
 * configured, that one. With several configured and no default set, this
 * refuses rather than guessing: picking whichever happened to be first is how
 * a draft lands on a client's site instead of your own.
 */
export function selectSite(config: Config, hint?: string): Site {
  if (config.sites.length === 0) {
    throw new Error(
      "No WordPress site is configured. Set WORDPRESS_SITE_URL, WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD, or WORDPRESS_SITES for several sites. Run `wordpress-mcp doctor` for the details.",
    );
  }

  const names = config.sites.map((s) => s.name);

  if (hint?.trim()) {
    const wanted = hint.trim().toLowerCase();
    const byName = config.sites.find((s) => s.name === wanted);
    if (byName) return byName;
    // A URL is what someone has to hand when they have not learned the labels.
    const asUrl = normalizeSiteUrl(wanted);
    const byUrl = config.sites.find((s) => s.url.toLowerCase() === asUrl.toLowerCase());
    if (byUrl) return byUrl;
    throw new Error(
      `Unknown site "${hint}". Configured sites: ${names.join(", ")}. Call wp_list_sites to see them with their URLs.`,
    );
  }

  if (config.defaultSite) {
    const preferred = config.sites.find((s) => s.name === config.defaultSite);
    if (preferred) return preferred;
    process.stderr.write(
      `[wordpress-mcp] WORDPRESS_DEFAULT_SITE="${config.defaultSite}" matches no configured site. Configured: ${names.join(", ")}.\n`,
    );
  }

  const only = config.sites[0];
  if (config.sites.length === 1 && only) return only;

  throw new Error(
    `Several WordPress sites are configured and this call did not say which one to use. Pass site as one of: ${names.join(", ")}. Set WORDPRESS_DEFAULT_SITE to choose one without asking every time.`,
  );
}
