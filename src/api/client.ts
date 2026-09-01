/**
 * One WordPress install, over the REST API.
 *
 * Two namespaces are in play and the difference matters to the caller. `wp/v2`
 * is WordPress core and is present on every modern install. `wordpress-mcp/v1`
 * comes from the helper plugin in this repo, and a 404 there means the plugin
 * is missing rather than the request being wrong, so it is translated into an
 * error that says which file to copy.
 *
 * Authentication is Basic with an application password. That is WordPress's own
 * scheme since 5.6, and the reason this server needs no OAuth app, no callback
 * URL and no plugin just to sign in.
 */

import {
  errorFromResponse,
  HelperPluginMissingError,
  networkError,
  WordPressError,
} from "./errors.js";
import type { Config, Site } from "../config.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const CORE_NAMESPACE = "wp/v2";
export const HELPER_NAMESPACE = "wordpress-mcp/v1";

/**
 * A list response, with the counts WordPress puts in headers rather than the body.
 *
 * Without these a model has no idea whether it saw everything or the first ten
 * of four hundred, and will happily report "you have 10 posts". The headers are
 * the only place that number exists.
 */
export type Paged<T = unknown> = {
  data: T;
  total?: number;
  total_pages?: number;
};

export class WpClient {
  readonly site: Site;
  private readonly config: Config;
  private readonly fetchImpl: FetchLike;

  constructor(site: Site, config: Config, fetchImpl: FetchLike = fetch) {
    this.site = site;
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  get name(): string {
    return this.site.name;
  }

  private authHeader(): string {
    const raw = `${this.site.username}:${this.site.appPassword}`;
    return `Basic ${Buffer.from(raw).toString("base64")}`;
  }

  private url(namespace: string, endpoint: string, params?: Record<string, unknown>): string {
    const clean = endpoint.replace(/^\/+/, "");
    const url = new URL(`${this.site.url}/wp-json/${namespace}/${clean}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    return url.toString();
  }

  /**
   * One request, with a deadline and a bounded retry.
   *
   * Retries cover 429 and 5xx only. A 4xx is the caller's problem and repeating
   * it just burns time, and a retried POST on a flaky connection is how a post
   * gets published twice, so writes are never retried.
   */
  private async request(
    method: string,
    namespace: string,
    endpoint: string,
    options: {
      params?: Record<string, unknown>;
      body?: unknown;
      rawBody?: Buffer;
      headers?: Record<string, string>;
      tool?: string;
    } = {},
  ): Promise<{ payload: unknown; response: Response }> {
    const url = this.url(namespace, endpoint, options.params);
    const idempotent = method === "GET";
    const attempts = idempotent ? this.config.maxRetries + 1 : 1;

    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
      try {
        const headers: Record<string, string> = {
          Authorization: this.authHeader(),
          Accept: "application/json",
          "User-Agent": this.config.userAgent,
          ...options.headers,
        };
        let body: RequestInit["body"];
        if (options.rawBody) {
          body = options.rawBody as unknown as RequestInit["body"];
        } else if (options.body !== undefined) {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(options.body);
        }

        const response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < attempts - 1) {
            await delay(400 * (attempt + 1));
            continue;
          }
          if (response.status === 404 && namespace === HELPER_NAMESPACE) {
            throw new HelperPluginMissingError(this.site.name, options.tool ?? "This tool");
          }
          throw await errorFromResponse(response, this.site.name, endpoint);
        }

        const text = await response.text();
        const payload = text ? safeParse(text, this.site.name, endpoint) : null;
        return { payload, response };
      } catch (error) {
        if (error instanceof WordPressError || error instanceof HelperPluginMissingError) throw error;
        lastError = error;
        if (attempt < attempts - 1) {
          await delay(400 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw networkError(lastError, this.site.name, url);
  }

  /** A core GET, with the pagination headers folded in when WordPress sends them. */
  async get(endpoint: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const { payload, response } = await this.request("GET", CORE_NAMESPACE, endpoint, { params });
    return withPaging(payload, response);
  }

  async post(endpoint: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const { payload } = await this.request("POST", CORE_NAMESPACE, endpoint, { body });
    return payload;
  }

  /**
   * WordPress accepts POST for updates as well as PUT, and some hosts and
   * security plugins drop PUT entirely. POST is the safer verb on an endpoint
   * that treats them identically.
   */
  async update(endpoint: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const { payload } = await this.request("POST", CORE_NAMESPACE, endpoint, { body });
    return payload;
  }

  async delete(endpoint: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const { payload } = await this.request("DELETE", CORE_NAMESPACE, endpoint, { params });
    return payload;
  }

  async helperGet(
    endpoint: string,
    params: Record<string, unknown> = {},
    tool?: string,
  ): Promise<unknown> {
    const { payload, response } = await this.request("GET", HELPER_NAMESPACE, endpoint, {
      params,
      tool,
    });
    return withPaging(payload, response);
  }

  async helperPost(
    endpoint: string,
    body: Record<string, unknown> = {},
    tool?: string,
  ): Promise<unknown> {
    const { payload } = await this.request("POST", HELPER_NAMESPACE, endpoint, { body, tool });
    return payload;
  }

  async helperDelete(endpoint: string, tool?: string): Promise<unknown> {
    const { payload } = await this.request("DELETE", HELPER_NAMESPACE, endpoint, { tool });
    return payload;
  }

  /**
   * Upload bytes to the media library.
   *
   * Media is the one endpoint that does not take JSON: WordPress wants the raw
   * file with the filename in Content-Disposition. Title, alt text and caption
   * cannot be sent in the same call, so they are applied in a follow-up PATCH,
   * which is why this returns the updated attachment rather than the created one.
   */
  async uploadMedia(input: {
    bytes: Buffer;
    filename: string;
    contentType: string;
  }): Promise<unknown> {
    const { payload } = await this.request("POST", CORE_NAMESPACE, "media", {
      rawBody: input.bytes,
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizeFilename(input.filename)}"`,
        "Content-Type": input.contentType,
      },
    });
    return payload;
  }

  /** Whether the helper plugin is present, for `doctor` and `wp_list_sites`. */
  async hasHelperPlugin(): Promise<boolean> {
    try {
      await this.request("GET", HELPER_NAMESPACE, "redirects", { params: { per_page: 1 } });
      return true;
    } catch (error) {
      if (error instanceof HelperPluginMissingError) return false;
      // Any other failure means the route answered, so the plugin is installed
      // even if this particular call was refused.
      return !(error instanceof WordPressError && error.status === 0);
    }
  }
}

function withPaging(payload: unknown, response: Response): unknown {
  const total = response.headers.get("X-WP-Total");
  const totalPages = response.headers.get("X-WP-TotalPages");
  if (!total) return payload;
  return {
    data: payload,
    total: Number.parseInt(total, 10),
    total_pages: totalPages ? Number.parseInt(totalPages, 10) : undefined,
  } satisfies Paged;
}

function safeParse(text: string, site: string, endpoint: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new WordPressError({
      message: `${site} answered with something that is not JSON. A caching or security plugin in front of the REST API is the usual cause.`,
      status: 200,
      code: "invalid_json",
      site,
      endpoint,
      detail: text.slice(0, 300),
    });
  }
}

/**
 * Strip anything that would break the Content-Disposition header.
 *
 * A quote in a filename ends the header value early, and a path separator lets
 * a caller aim the upload somewhere other than the uploads directory.
 */
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload.bin";
  const clean = base.replace(/["\r\n]/g, "").trim();
  return clean || "upload.bin";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
