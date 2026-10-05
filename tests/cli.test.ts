/**
 * The two surfaces, now that Slipway builds both from ALL_TOOLS.
 *
 * Parsing, help and the exit-code contract are Slipway's and tested there. What
 * matters here: every tool arrives on both surfaces intact, under 1.1's command
 * names; the helper plugin's twelve are still marked; the resources and prompts
 * still reach a client; WordPress's errors keep their exit codes; and the docs
 * stay in step with the code.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT } from "@thenavidm/slipway";
import { checkApp, cli, connect } from "@thenavidm/slipway/testing";
import { HelperPluginMissingError, WordPressError } from "../src/api/errors.js";
import { app } from "../src/app.js";
import { ALL_TOOLS } from "../src/tools/index.js";
import { toSlipway } from "../src/tools/kit.js";

/** A fresh environment per call: the app keeps one context, and its clients, per environment. */
const site = (): NodeJS.ProcessEnv => ({
  WORDPRESS_SITE_URL: "https://example.com",
  WORDPRESS_USERNAME: "a",
  WORDPRESS_APP_PASSWORD: "aaaa bbbb cccc dddd eeee ffff",
});

afterEach(() => vi.restoreAllMocks());

describe("WordPress on Slipway", () => {
  it("offers every tool as a command and over MCP, under the same names", async () => {
    const list = await cli(app, [], { env: site() });
    for (const tool of ALL_TOOLS) expect(list.stdout).toContain(tool.command);
    const mcp = await connect(app, { env: site() });
    const names = (await mcp.listTools()).map((tool) => tool.name);
    await mcp.close();
    expect(names).toEqual(ALL_TOOLS.map((tool) => tool.name));
  });

  it("routes a command in both spellings, as 1.1 did", async () => {
    expect((await cli(app, ["wp-list-sites"], { env: site() })).code).toBe(0);
    expect((await cli(app, ["wp_list_sites"], { env: site() })).code).toBe(0);
  });

  it("groups the twelve that need the helper plugin under a heading that says so", async () => {
    const list = (await cli(app, [], { env: site() })).stdout;
    const helper = list.slice(list.indexOf("helper: need the helper plugin"));
    for (const tool of ALL_TOOLS.filter((t) => t.tags.includes("helper"))) expect(helper).toContain(tool.command);
    expect(helper).not.toContain("wp-list-posts");
  });

  it("serves the sites and concepts resources and the three prompts", async () => {
    const mcp = await connect(app, { env: site() });
    const resources = (await mcp.request("resources/list")) as { resources: Array<{ uri: string }> };
    const sites = (await mcp.request("resources/read", { uri: "wordpress://sites" })) as { contents: Array<{ text: string }> };
    const prompts = (await mcp.request("prompts/list")) as { prompts: Array<{ name: string }> };
    await mcp.close();
    expect(resources.resources.map((r) => r.uri).sort()).toEqual(["wordpress://concepts", "wordpress://sites"]);
    expect(JSON.parse(sites.contents[0]!.text)).toMatchObject({ sites: [{ name: "example", url: "https://example.com", username: "a" }], read_only: false });
    expect(sites.contents[0]!.text).not.toContain("aaaa");
    expect(prompts.prompts.map((p) => p.name)).toEqual(["draft-post", "audit-seo", "find-and-fix"]);
  });

  it("exits 10 when no site is configured, and 2 for a missing argument", async () => {
    expect((await cli(app, ["wp-list-posts"], { env: {} })).code).toBe(EXIT.notConfigured);
    expect((await cli(app, ["doctor"], { env: {} })).code).toBe(EXIT.notConfigured);
    expect((await cli(app, ["wp-get-post"], { env: site() })).code).toBe(EXIT.usage);
  });

  it("takes a list of numbers as repeated flags, and refuses one that is not", async () => {
    const calls = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ deleted: 2 }), { status: 200 }));
    const run = await cli(app, ["wp-bulk-delete", "--post-ids", "1", "--post-ids", "22", "--confirm"], { env: site() });
    expect(run.code).toBe(0);
    expect(JSON.parse(calls.mock.calls[0]![1]!.body as string)).toMatchObject({ post_ids: [1, 22] });
    expect((await cli(app, ["wp-bulk-delete", "--post-ids", "x", "--confirm"], { env: site() })).code).toBe(EXIT.usage);
  });

  it("passes slipway check", async () => {
    const report = await checkApp(app, { env: site() });
    expect(report.findings.filter((finding) => finding.level === "error")).toEqual([]);
  });
});

describe("WordPress's errors keep their exit codes", () => {
  const wp = (status: number, code: string, message = "WordPress refused.") =>
    new WordPressError({ message, status, code, site: "blog", endpoint: "posts" });

  it.each([
    ["a rejected application password", wp(401, "incorrect_password"), EXIT.auth],
    ["an Author editing someone else's post", wp(403, "rest_cannot_edit"), EXIT.auth],
    ["a post that does not exist", wp(404, "rest_post_invalid_id"), EXIT.notFound],
    ["the helper plugin's own missing post", wp(404, "not_found"), EXIT.notFound],
    ["a 429", wp(429, "http_429"), EXIT.rateLimited],
    ["a security plugin's rate limit, sent as a 403", wp(403, "too_many", "Rate limit exceeded, try later."), EXIT.rateLimited],
    ["an argument WordPress rejected", wp(400, "rest_invalid_param"), EXIT.usage],
    ["a broken site", wp(500, "http_500"), EXIT.api],
    ["a site that never answered", wp(0, "network_error", "Could not reach blog."), EXIT.api],
    ["a timeout", wp(0, "timeout", "The request to blog timed out."), EXIT.api],
    ["Rank Math switched off", wp(400, "plugin_not_active", "RankMath SEO plugin is not active"), EXIT.notConfigured],
    ["Rank Math's redirections module off", wp(400, "no_redirects_table"), EXIT.notConfigured],
    ["the helper plugin missing", new HelperPluginMissingError("blog", "wp_get_elementor"), EXIT.notConfigured],
  ])("%s", (_name, raw, code) => {
    expect(toSlipway(raw).exitCode).toBe(code);
  });

  it("keeps WordPress's code, the site and the endpoint, and no status for a site that never answered", () => {
    const known = toSlipway(wp(0, "network_error"));
    expect(known.details).toMatchObject({ reason: "network_error", site: "blog", endpoint: "posts" });
    expect(known.status).toBeUndefined();
    expect(toSlipway(wp(0, "timeout")).code).toBe("timeout");
  });
});

describe("documentation stays in step with the code", () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf-8");
  const names = (text: string): Set<string> => new Set((text.match(/WORDPRESS_[A-Z_]+/g) ?? []).filter((name) => !name.endsWith("_")));
  const source = (dir: string): string =>
    readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
      .map((entry) => (entry.isDirectory() ? source(`${dir}${entry.name}/`) : entry.name.endsWith(".ts") ? read(`${dir}${entry.name}`) : ""))
      .join("\n");

  /** Every variable the server reads: this repo's code, and Slipway's as agent-context lists them. */
  const used = async (): Promise<Set<string>> => {
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout);
    return new Set([...names(source("../src/")), ...context.settings.map((setting: { env: string }) => setting.env)]);
  };

  /**
   * Four variables shipped undocumented and three never reached `--help`, which
   * is the kind of drift nobody notices because both sides look complete on
   * their own.
   */
  it("documents every environment variable the code reads", async () => {
    const documented = names(read("../README.md"));
    expect([...(await used())].filter((v) => !documented.has(v))).toEqual([]);
  });

  // Since Slipway 0.1.15 the help names the settings that connect an account and the safety
  // switches, and counts the rest, which agent-context describes one by one.
  it("names every environment variable in --help or agent-context", async () => {
    const help = (await cli(app, ["--help"], { env: {} })).stdout;
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout);
    const described = new Set(context.settings.map((setting: { env: string }) => setting.env));
    expect([...(await used())].filter((v) => !help.includes(v) && !described.has(v))).toEqual([]);
  });

  /**
   * Two in-page links pointed at headings that had been renamed, including the
   * one row routing a shell user to the CLI. The ship checklist's link pass only
   * greps http, so a dead `#anchor` is the kind that ships quietly.
   */
  it.each(["../README.md", "../INSTALL.md"])("has no dead in-page anchors in %s", (file) => {
    if (!existsSync(new URL(file, import.meta.url))) return; // repo may ship one doc
    const md = read(file).replace(/```[\s\S]*?```/g, "");
    // GitHub's slug keeps letters, marks, numbers and connector punctuation, so an
    // emoji's variation selector (U+FE0F) stays in the anchor and a link has to carry it.
    const slugs = new Set(
      [...md.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) =>
        (heading as string).trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, "").replace(/ /g, "-"),
      ),
    );
    const dead = [...md.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)]
      .map((m) => decodeURIComponent(m[1] as string))
      .filter((a) => !slugs.has(a));
    expect(dead).toEqual([]);
  });
});
