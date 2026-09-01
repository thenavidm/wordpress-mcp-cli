#!/usr/bin/env node
/**
 * Entry point.
 *
 * `wordpress-mcp`             stdio, which is what MCP clients launch
 * `wordpress-mcp --http`      HTTP, for running it somewhere always on
 * `wordpress-mcp doctor`      check the setup and say what is wrong
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, VERSION } from "./server.js";
import { loadConfig } from "./config.js";
import { httpOptionsFromEnv, startHttpServer } from "./transport/http.js";

const HELP = `wordpress-mcp ${VERSION}

  wordpress-mcp                     Run over stdio. This is what an MCP client launches.
  wordpress-mcp --http [--port=N]   Run over HTTP, for a machine that is always on.
  wordpress-mcp doctor              Check the setup and report what is wrong.
  wordpress-mcp --version           Print the version.

Credentials, in priority order:
  WORDPRESS_SITES           JSON array, for several sites at once:
                            [{"name":"blog","url":"https://example.com","username":"you","app_password":"xxxx xxxx xxxx xxxx xxxx xxxx"}]
  WORDPRESS_SITE_URL        the site, e.g. https://example.com
  WORDPRESS_USERNAME        your WordPress login name
  WORDPRESS_APP_PASSWORD    from Users > Profile > Application Passwords, not your login password

Options:
  WORDPRESS_DEFAULT_SITE            which site acts when a tool names none
  WORDPRESS_READ_ONLY=1             hide every write from the tool list
  WORDPRESS_ALLOW_DESTRUCTIVE=0     keep writes, block publishing and permanent deletion
  WORDPRESS_REQUEST_TIMEOUT_MS      per-request deadline, default 30000
  WORDPRESS_AUDIT_LOG               append-only log of every attempted write
  WORDPRESS_HTTP_PORT / _HOST / _TOKEN  for --http

https://github.com/navidmoazzez/wordpress-mcp
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (argv.includes("--help") || argv.includes("-h") || command === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === "doctor") {
    const { runDoctor } = await import("./doctor.js");
    process.exitCode = await runDoctor();
    return;
  }

  const config = loadConfig();
  const built = buildServer(config);

  // Warn, never block. A network check at startup would delay the handshake,
  // and the failure is more actionable on the tool call that hits it.
  if (config.sites.length === 0) {
    process.stderr.write(
      "[wordpress-mcp] No WordPress site is configured, so every tool will report the missing setup. Run `wordpress-mcp doctor` for what to set.\n",
    );
  }

  const shutdown = async (close?: () => Promise<void>): Promise<void> => {
    if (close) await close().catch(() => undefined);
    process.exit(0);
  };

  if (argv.includes("--http")) {
    const { close } = await startHttpServer(built, httpOptionsFromEnv(argv));
    process.on("SIGTERM", () => void shutdown(close));
    process.on("SIGINT", () => void shutdown(close));
    return;
  }

  const transport = new StdioServerTransport();
  await built.server.connect(transport);

  // Handled so `docker stop` and a client shutting down return promptly rather
  // than waiting out a grace period.
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error: unknown) => {
  process.stderr.write(`[wordpress-mcp] ${(error as Error).message}\n`);
  process.exit(1);
});
