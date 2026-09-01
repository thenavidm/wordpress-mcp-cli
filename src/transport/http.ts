/**
 * HTTP transport, for running the server somewhere always on.
 *
 * Streamable HTTP, stateless: every request builds its own transport and tears
 * it down. No session map means no session leak, which matters more here than
 * the reconnect support a stateful server would buy.
 *
 * The thing to understand before hosting this is what is on the other end of
 * the port. This server holds an application password that can publish, edit
 * and permanently delete content on a live website. Anything that can reach it
 * can do all of that, without ever seeing the password. That is a materially
 * different exposure from a server that only reads.
 *
 * So it binds loopback by default, and it refuses to bind anywhere else
 * without a token. Refuses rather than warns: a warning in stderr is not read,
 * and the failure mode is somebody else's agent publishing to the site.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { BuiltServer } from "../server.js";

export type HttpOptions = {
  port: number;
  host: string;
  /** When set, every request must send `Authorization: Bearer <token>`. */
  token?: string;
};

export function httpOptionsFromEnv(argv: string[] = []): HttpOptions {
  const flag = argv.find((a) => a.startsWith("--port="));
  const port = Number(flag?.split("=")[1] ?? process.env.WORDPRESS_HTTP_PORT ?? 8790);
  return {
    port: Number.isFinite(port) && port > 0 ? port : 8790,
    host: process.env.WORDPRESS_HTTP_HOST || "127.0.0.1",
    token: process.env.WORDPRESS_HTTP_TOKEN || undefined,
  };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Constant-time comparison, so the token cannot be guessed byte by byte. */
function tokenMatches(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

async function handle(
  built: BuiltServer,
  options: HttpOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Health needs no auth: it reports counts and mode, never a site's content
  // and never a credential.
  if (req.method === "GET" && (req.url === "/health" || req.url === "/healthz")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        tools: built.toolCount,
        sites: built.config.sites.length,
        read_only: built.config.readOnly,
      }),
    );
    return;
  }

  if (options.token) {
    const header = req.headers.authorization ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!provided || !tokenMatches(options.token, provided)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => void transport.close());
  await built.server.connect(transport);
  await transport.handleRequest(req, res, await readBody(req));
}

function isLoopback(host: string): boolean {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host.toLowerCase());
}

export async function startHttpServer(
  built: BuiltServer,
  options: HttpOptions,
): Promise<{ close: () => Promise<void> }> {
  if (!isLoopback(options.host) && !options.token) {
    throw new Error(
      `Refusing to bind ${options.host} without a token. This server can publish, edit and permanently delete content on a live site, so an open port hands that to anyone who can reach it. Set WORDPRESS_HTTP_TOKEN to a long random string, or keep the default host of 127.0.0.1. Adding WORDPRESS_READ_ONLY=1 as well removes the writes entirely.`,
    );
  }

  const http = createServer((req, res) => {
    void handle(built, options, req, res).catch((error: unknown) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: (error as Error)?.message ?? "internal error" },
          id: null,
        }),
      );
    });
  });

  await new Promise<void>((resolve) => http.listen(options.port, options.host, resolve));

  process.stderr.write(
    `[wordpress-mcp] HTTP on http://${options.host}:${options.port} (${built.toolCount} tools, ${built.config.sites.length} site${built.config.sites.length === 1 ? "" : "s"})\n${
      options.token ? "" : "[wordpress-mcp] No WORDPRESS_HTTP_TOKEN set: this endpoint is unauthenticated on loopback.\n"
    }`,
  );

  return {
    close: () =>
      new Promise<void>((resolve) => {
        http.close(() => resolve());
      }),
  };
}
