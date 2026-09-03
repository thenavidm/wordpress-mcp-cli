#!/usr/bin/env node
/**
 * Entry point.
 *
 * `wordpress-mcp`             stdio, which is what MCP clients launch
 * `wordpress-mcp --http`      HTTP, for running it somewhere always on
 * `wordpress-mcp doctor`      check the setup and say what is wrong
 * `wordpress-cli <command>`   the same tools as shell commands
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, VERSION } from "./server.js";
import { loadConfig } from "./config.js";
import { httpOptionsFromEnv, startHttpServer } from "./transport/http.js";
import { isCliCommand, runCli } from "./cli.js";

const HELP = `wordpress-mcp ${VERSION}

  wordpress-mcp                     Run over stdio. This is what an MCP client launches.
  wordpress-mcp --http [--port=N]   Run over HTTP, for a machine that is always on.
  wordpress-mcp doctor              Check the setup and report what is wrong.
  wordpress-mcp --version           Print the version.

  wordpress-cli                     List every tool as a shell command.
  wordpress-cli <command> --help    What one command takes.

Credentials, in priority order:
  WORDPRESS_SITES           JSON array, for several sites at once:
                            [{"name":"blog","url":"https://example.com","username":"you","app_password":"xxxx xxxx xxxx xxxx xxxx xxxx"}]
  WORDPRESS_SITE_URL        the site, e.g. https://example.com
  WORDPRESS_USERNAME        your WordPress login name
  WORDPRESS_APP_PASSWORD    from Users > Profile > Application Passwords, not your login password
  WORDPRESS_SITE_NAME       the short label for that single site, defaults to its hostname

Options:
  WORDPRESS_DEFAULT_SITE            which site acts when a tool names none
  WORDPRESS_READ_ONLY=1             hide every write from the tool list
  WORDPRESS_ALLOW_DESTRUCTIVE=0     keep writes, block publishing and permanent deletion
  WORDPRESS_REQUEST_TIMEOUT_MS      per-request deadline, default 30000
  WORDPRESS_MAX_RETRIES             retries on rate limits and 5xx, default 2
  WORDPRESS_USER_AGENT              override the User-Agent sent to the site
  WORDPRESS_AUDIT_LOG               append-only log of every attempted write
  WORDPRESS_HTTP_PORT / _HOST / _TOKEN  for --http

https://github.com/thenavidm/wordpress-mcp-cli
`;

/**
 * One entry point, two programs. `wordpress-mcp` is the server and must stay
 * silent on stdout; `wordpress-cli` is the one a person types. Running the CLI
 * binary with no arguments is someone asking what they can type, so it lists
 * the commands rather than hanging on a transport that will never speak.
 */
function invokedAsCli(): boolean {
  const name = (process.argv[1] ?? "").split("/").pop() ?? "";
  return name.startsWith("wordpress-cli");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (invokedAsCli() && argv.length === 0) {
    process.exitCode = await runCli(["tools"]);
    return;
  }

  // Checked before --help and --version so `<tool> --help` reaches the tool.
  // A bare `--help` starts with a dash, so it falls through to the block below.
  if (isCliCommand(argv)) {
    process.exitCode = await runCli(argv);
    return;
  }

  // An unknown word used to fall through and start the server, which then sat
  // waiting on stdin: a typo looked like a hang, and scripts saw exit code 0.
  // `doctor` and `help` belong to the entry point rather than the tool list,
  // and they are the first things someone types when nothing works. Rejecting
  // them as unknown commands sent that person to the server binary to diagnose
  // the CLI.
  const ENTRY_COMMANDS = new Set(["doctor", "help"]);

  if (
    invokedAsCli() &&
    command !== undefined &&
    !command.startsWith("-") &&
    !ENTRY_COMMANDS.has(command)
  ) {
    process.stderr.write(
      `${JSON.stringify({ error: `Unknown command '${command}'. Run \`wordpress-cli\` to list them.` }, null, 2)}\n`,
    );
    process.exitCode = 1;
    return;
  }

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
