import { describe, expect, it } from "vitest";
import { configFromSites, loadConfig, selectSite, siteNameFromUrl } from "../src/config.js";

const APP_PASSWORD = "aaaa bbbb cccc dddd eeee ffff";

describe("loadConfig", () => {
  it("reads the single-site variables", () => {
    const config = loadConfig({
      WORDPRESS_SITE_URL: "https://example.com/",
      WORDPRESS_USERNAME: "navid",
      WORDPRESS_APP_PASSWORD: APP_PASSWORD,
    } as NodeJS.ProcessEnv);

    expect(config.sites).toHaveLength(1);
    expect(config.sites[0]).toMatchObject({
      name: "example",
      url: "https://example.com",
      username: "navid",
      appPassword: APP_PASSWORD,
    });
  });

  it("reads the JSON form", () => {
    const config = loadConfig({
      WORDPRESS_SITES: JSON.stringify([
        { name: "blog", url: "https://one.com", username: "a", app_password: APP_PASSWORD },
        { name: "shop", url: "https://two.com", username: "b", app_password: APP_PASSWORD },
      ]),
    } as NodeJS.ProcessEnv);

    expect(config.sites.map((s) => s.name)).toEqual(["blog", "shop"]);
  });

  it("still reads the pipe-delimited form, since existing client configs hold it", () => {
    const config = loadConfig({
      WP_SITES: `blog|https://one.com|navid|${APP_PASSWORD},shop|https://two.com/|other|${APP_PASSWORD}`,
    } as NodeJS.ProcessEnv);

    expect(config.sites).toHaveLength(2);
    expect(config.sites[1]).toMatchObject({ name: "shop", url: "https://two.com", username: "other" });
  });

  it("keeps the spaces in an application password, because WordPress displays them", () => {
    const config = loadConfig({
      WP_SITES: `blog|https://one.com|navid|${APP_PASSWORD}`,
    } as NodeJS.ProcessEnv);
    expect(config.sites[0]?.appPassword).toBe(APP_PASSWORD);
  });

  it("drops an entry missing a credential rather than half-configuring it", () => {
    const config = loadConfig({
      WP_SITES: "blog|https://one.com|navid|,shop|https://two.com|other|" + APP_PASSWORD,
    } as NodeJS.ProcessEnv);
    expect(config.sites.map((s) => s.name)).toEqual(["shop"]);
  });

  it("makes duplicate site names unique, so one cannot shadow the other", () => {
    const config = loadConfig({
      WP_SITES: `a|https://one.com|x|${APP_PASSWORD},a|https://two.com|y|${APP_PASSWORD}`,
    } as NodeJS.ProcessEnv);
    expect(config.sites.map((s) => s.name)).toEqual(["a", "a-2"]);
  });

  it("defaults to writes on and destructive allowed", () => {
    const config = loadConfig({} as NodeJS.ProcessEnv);
    expect(config.readOnly).toBe(false);
    expect(config.allowDestructive).toBe(true);
  });

  it("reads the safety switches", () => {
    const config = loadConfig({
      WORDPRESS_READ_ONLY: "1",
      WORDPRESS_ALLOW_DESTRUCTIVE: "0",
      WORDPRESS_AUDIT_LOG: "/tmp/wp.log",
    } as NodeJS.ProcessEnv);
    expect(config.readOnly).toBe(true);
    expect(config.allowDestructive).toBe(false);
    expect(config.auditPath).toBe("/tmp/wp.log");
  });
});

describe("siteNameFromUrl", () => {
  it("uses the host without www or the suffix", () => {
    expect(siteNameFromUrl("https://www.example.com")).toBe("example");
    expect(siteNameFromUrl("https://blog.example.co.uk/")).toBe("blog");
  });
});

describe("selectSite", () => {
  const two = configFromSites([
    { name: "blog", url: "https://one.com", username: "a", appPassword: APP_PASSWORD },
    { name: "shop", url: "https://two.com", username: "b", appPassword: APP_PASSWORD },
  ]);

  it("returns the only site when there is one", () => {
    const one = configFromSites([
      { name: "blog", url: "https://one.com", username: "a", appPassword: APP_PASSWORD },
    ]);
    expect(selectSite(one).name).toBe("blog");
  });

  it("refuses to guess between several rather than picking the first", () => {
    expect(() => selectSite(two)).toThrow(/did not say which one/);
  });

  it("uses the configured default", () => {
    const withDefault = { ...two, defaultSite: "shop" };
    expect(selectSite(withDefault).name).toBe("shop");
  });

  it("matches by name or by URL", () => {
    expect(selectSite(two, "blog").name).toBe("blog");
    expect(selectSite(two, "https://two.com").name).toBe("shop");
    expect(selectSite(two, "two.com").name).toBe("shop");
  });

  it("names the configured sites when given an unknown one", () => {
    expect(() => selectSite(two, "nope")).toThrow(/blog, shop/);
  });

  it("says what to set when nothing is configured", () => {
    expect(() => selectSite(configFromSites([]))).toThrow(/No WordPress site is configured/);
  });
});
