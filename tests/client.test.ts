import { describe, expect, it, vi } from "vitest";
import { WpClient } from "../src/api/client.js";
import { configFromSites, type Site } from "../src/config.js";
import { HelperPluginMissingError, WordPressError } from "../src/api/errors.js";

const site: Site = {
  name: "blog",
  url: "https://example.com",
  username: "navid",
  appPassword: "aaaa bbbb cccc dddd eeee ffff",
};
const config = configFromSites([site]);

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("WpClient", () => {
  it("sends Basic auth built from the username and application password", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    await new WpClient(site, config, fetchImpl).get("posts");

    const [, init] = fetchImpl.mock.calls[0]!;
    const header = (init!.headers as Record<string, string>).Authorization;
    expect(header.startsWith("Basic ")).toBe(true);
    expect(Buffer.from(header.slice(6), "base64").toString()).toBe(
      "navid:aaaa bbbb cccc dddd eeee ffff",
    );
  });

  it("folds the pagination headers in, so a partial page is not read as the whole set", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ id: 1 }], { headers: { "X-WP-Total": "400", "X-WP-TotalPages": "40" } }),
    );
    const result = (await new WpClient(site, config, fetchImpl).get("posts")) as {
      data: unknown[];
      total: number;
      total_pages: number;
    };
    expect(result.total).toBe(400);
    expect(result.total_pages).toBe(40);
    expect(result.data).toHaveLength(1);
  });

  it("leaves a response without pagination headers alone", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 7 }));
    const result = await new WpClient(site, config, fetchImpl).get("posts/7");
    expect(result).toEqual({ id: 7 });
  });

  it("drops empty parameters instead of sending them as blanks", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    await new WpClient(site, config, fetchImpl).get("posts", {
      search: "hello",
      status: undefined,
      author: "",
    });
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("search=hello");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("author=");
  });

  it("translates a WordPress error code into something actionable", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { code: "rest_cannot_edit", message: "Sorry, you are not allowed to edit this post." },
        { status: 403 },
      ),
    );
    await expect(new WpClient(site, config, fetchImpl).get("posts/1")).rejects.toThrow(
      /Application passwords carry the user's own role/,
    );
  });

  it("names the site in the error, since knowing which one refused is most of the diagnosis", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: "rest_forbidden" }, { status: 403 }));
    await expect(new WpClient(site, config, fetchImpl).get("posts")).rejects.toThrow(/site: blog/);
  });

  it("says so when something in front of WordPress answers with HTML", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html><body>Blocked</body></html>", { status: 403 }),
    );
    const error = await new WpClient(site, config, fetchImpl)
      .get("posts")
      .catch((e: unknown) => e as WordPressError);
    expect((error as WordPressError).detail).toMatch(/something in front of WordPress answered/);
  });

  it("turns a 404 on the helper namespace into the missing-plugin error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: "rest_no_route" }, { status: 404 }));
    await expect(
      new WpClient(site, config, fetchImpl).helperGet("elementor/5", {}, "wp_get_elementor"),
    ).rejects.toBeInstanceOf(HelperPluginMissingError);
  });

  it("leaves a 404 on the core namespace as an ordinary error", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ code: "rest_post_invalid_id" }, { status: 404 }),
    );
    const error = await new WpClient(site, config, fetchImpl)
      .get("posts/999")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordPressError);
    expect(error).not.toBeInstanceOf(HelperPluginMissingError);
  });

  it("retries a failed read", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: "server" }, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]));
    const result = await new WpClient(site, config, fetchImpl).get("posts");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: 1 }]);
  });

  it("never retries a write, because a retried publish publishes twice", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: "server" }, { status: 500 }));
    await expect(new WpClient(site, config, fetchImpl).post("posts", { title: "x" })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("strips quotes and path separators out of an upload filename", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 3 }));
    await new WpClient(site, config, fetchImpl).uploadMedia({
      bytes: Buffer.from("x"),
      filename: '../../evil".php',
      contentType: "image/png",
    });
    const [, init] = fetchImpl.mock.calls[0]!;
    const disposition = (init!.headers as Record<string, string>)["Content-Disposition"];
    expect(disposition).toBe('attachment; filename="evil.php"');
  });

  it("reports a network failure against the site rather than as an opaque throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    await expect(new WpClient(site, config, fetchImpl).get("posts")).rejects.toThrow(
      /Could not reach blog/,
    );
  });
});
