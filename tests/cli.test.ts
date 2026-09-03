/**
 * The CLI adapter.
 *
 * What matters here is that the shell surface is derived from the tool specs
 * rather than described a second time, so the tests that count are the ones
 * asserting parity with ALL_TOOLS and the ones covering the argv shapes a
 * person actually types.
 */

import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { flagsFor, parseArgs, isCliCommand } from "../src/cli.js";
import { ALL_TOOLS } from "../src/tools/index.js";

describe("flagsFor", () => {
  it("derives a flag per schema key, kebab-cased", () => {
    const flags = flagsFor({ per_page: z.number().optional() });
    expect(flags[0]).toMatchObject({ key: "per_page", flag: "--per-page", kind: "number" });
  });

  it("reads required from the absence of .optional()", () => {
    const flags = flagsFor({ title: z.string(), site: z.string().optional() });
    expect(flags.find((f) => f.key === "title")?.required).toBe(true);
    expect(flags.find((f) => f.key === "site")?.required).toBe(false);
  });

  it("carries .describe() through as help", () => {
    const flags = flagsFor({ title: z.string().describe("The post title.") });
    expect(flags[0]?.help).toBe("The post title.");
  });

  it("finds the description whichever side of .optional() it was chained", () => {
    const outer = flagsFor({ a: z.string().optional().describe("outer") });
    const inner = flagsFor({ b: z.string().describe("inner").optional() });
    expect(outer[0]?.help).toBe("outer");
    expect(inner[0]?.help).toBe("inner");
  });

  it("exposes an enum's values as choices", () => {
    const flags = flagsFor({ status: z.enum(["draft", "publish"]).optional() });
    expect(flags[0]).toMatchObject({ kind: "enum", choices: ["draft", "publish"] });
  });

  it("marks a scalar array repeatable and an object array json", () => {
    const flags = flagsFor({
      categories: z.array(z.number()).optional(),
      updates: z.array(z.object({ id: z.number() })).optional(),
    });
    expect(flags.find((f) => f.key === "categories")).toMatchObject({
      kind: "string",
      repeatable: true,
    });
    expect(flags.find((f) => f.key === "updates")).toMatchObject({ kind: "json", repeatable: true });
  });
});

describe("parseArgs", () => {
  const flags = flagsFor({
    title: z.string(),
    per_page: z.number().optional(),
    confirm: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
    meta: z.object({ key: z.string() }).optional(),
    status: z.enum(["draft", "publish"]).optional(),
  });

  it("accepts --flag value and --flag=value alike", () => {
    expect(parseArgs(["--title", "hi"], flags)).toEqual({ title: "hi" });
    expect(parseArgs(["--title=hi"], flags)).toEqual({ title: "hi" });
  });

  it("accepts the underscore spelling of a flag", () => {
    expect(parseArgs(["--per_page", "20"], flags)).toEqual({ per_page: 20 });
  });

  it("treats a boolean as a bare switch", () => {
    expect(parseArgs(["--title", "hi", "--confirm"], flags)).toEqual({ title: "hi", confirm: true });
    expect(parseArgs(["--confirm=false"], flags)).toEqual({ confirm: false });
  });

  it("coerces numbers, and refuses ones that are not", () => {
    expect(parseArgs(["--per-page", "25"], flags)).toEqual({ per_page: 25 });
    expect(() => parseArgs(["--per-page", "many"], flags)).toThrow(/expects a number/);
  });

  it("parses a json flag, and refuses malformed json", () => {
    expect(parseArgs(['--meta={"key":"value"}'], flags)).toEqual({ meta: { key: "value" } });
    expect(() => parseArgs(["--meta", "{oops"], flags)).toThrow(/expects JSON/);
  });

  it("collects a repeatable flag into an array", () => {
    expect(parseArgs(["--categories", "4", "--categories", "9"], flags)).toEqual({
      categories: ["4", "9"],
    });
  });

  it("checks an enum against its choices", () => {
    expect(() => parseArgs(["--status", "live"], flags)).toThrow(/expects one of/);
  });

  it("fills the first required flag from a bare argument", () => {
    expect(parseArgs(["Hello world"], flags)).toEqual({ title: "Hello world" });
  });

  it("wraps a bare argument when the required flag is repeatable", () => {
    const repeatable = flagsFor({ post_ids: z.array(z.string()) });
    expect(parseArgs(["42"], repeatable)).toEqual({ post_ids: ["42"] });
  });

  it("refuses an unknown option rather than dropping it", () => {
    expect(() => parseArgs(["--nope", "x"], flags)).toThrow(/Unknown option/);
  });

  it("refuses a second bare argument", () => {
    expect(() => parseArgs(["one", "two"], flags)).toThrow(/Unexpected argument/);
  });
});

describe("parity with the MCP surface", () => {
  it("routes every tool name, in both spellings", () => {
    for (const tool of ALL_TOOLS) {
      expect(isCliCommand([tool.name])).toBe(true);
      expect(isCliCommand([tool.name.replace(/_/g, "-")])).toBe(true);
    }
  });

  it("builds flags for every tool without throwing", () => {
    for (const tool of ALL_TOOLS) {
      expect(() => flagsFor(tool.schema)).not.toThrow();
    }
  });

  it("gives every schema key a flag", () => {
    for (const tool of ALL_TOOLS) {
      expect(flagsFor(tool.schema)).toHaveLength(Object.keys(tool.schema).length);
    }
  });

  it("leaves the server's own flags alone", () => {
    expect(isCliCommand(["--http"])).toBe(false);
    expect(isCliCommand(["--version"])).toBe(false);
    expect(isCliCommand([])).toBe(false);
  });
});

describe("documentation stays in step with the code", () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf-8");
  const names = (text: string): Set<string> => new Set(text.match(/WORDPRESS_[A-Z_]+/g) ?? []);

  /**
   * Four variables shipped undocumented and three never reached `--help`, which
   * is the kind of drift nobody notices because both sides look complete on
   * their own.
   */
  it("documents every environment variable the code reads", () => {
    const used = names(["config.ts", "transport/http.ts"].map((f) => read(`../src/${f}`)).join("\n"));
    const documented = names(read("../README.md"));
    expect([...used].filter((v) => !documented.has(v))).toEqual([]);
  });

  it("lists every environment variable in --help", () => {
    const used = names(["config.ts", "transport/http.ts"].map((f) => read(`../src/${f}`)).join("\n"));
    const helped = names(read("../src/index.ts"));
    // The help groups the three HTTP ones as `WORDPRESS_HTTP_PORT / _HOST / _TOKEN`.
    const shorthand = new Set(["WORDPRESS_HTTP_HOST", "WORDPRESS_HTTP_TOKEN"]);
    expect([...used].filter((v) => !helped.has(v) && !shorthand.has(v))).toEqual([]);
  });

  /**
   * Two in-page links pointed at headings that had been renamed, including the
   * one row routing a shell user to the CLI. The ship checklist's link pass only
   * greps http, so a dead `#anchor` is the kind that ships quietly.
   */
  it.each(["../README.md", "../INSTALL.md"])("has no dead in-page anchors in %s", (file) => {
    if (!existsSync(new URL(file, import.meta.url))) return; // repo may ship one doc
    const md = read(file);
    const slugs = new Set<string>();
    for (const [, heading] of md.matchAll(/^#{2,4} (.+)$/gm)) {
      const stripped = (heading as string).toLowerCase().replace(/[^\w\s-]/g, "");
      // GitHub keeps the trailing hyphen when a heading ends in an emoji.
      slugs.add(stripped.trim().replace(/\s+/g, "-"));
      slugs.add(stripped.replace(/\s+/g, "-"));
    }
    const dead = [...md.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)]
      .map((m) => m[1] as string)
      .filter((a) => !slugs.has(a));
    expect(dead).toEqual([]);
  });
});
