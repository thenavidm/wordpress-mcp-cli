/**
 * `wordpress-cli doctor`: check every site the way a write would reach it.
 *
 * HTTPS first, because WordPress disables application passwords over plain
 * HTTP and the resulting 401 says nothing about why. Then the password's shape,
 * a real sign-in, the user's role, and whether the helper plugin is there.
 * Slipway runs these on every `doctor`, as 1.1 did, after its own checks.
 */

import type { DoctorCheck } from "@thenavidm/slipway";
import { WpClient } from "./api/client.js";
import { HelperPluginMissingError, WordPressError } from "./api/errors.js";
import type { Config, Site } from "./config.js";
import type { ToolContext } from "./tools/kit.js";

function describe(error: unknown): string {
  if (error instanceof HelperPluginMissingError) return error.message;
  if (error instanceof WordPressError) return error.message;
  return (error as Error)?.message ?? String(error);
}

export async function doctor({ config }: ToolContext, options: { network: boolean }): Promise<DoctorCheck[]> {
  if (config.sites.length === 0) return [];
  const checks: DoctorCheck[] = [
    {
      name: "Sites",
      ok: true,
      detail: `${config.sites.map((site) => site.name).join(", ")}; ${
        config.defaultSite ? `default ${config.defaultSite}` : config.sites.length > 1 ? "no default, so every call must name one" : "single site, named automatically"
      }`,
    },
  ];
  for (const site of config.sites) checks.push(...(await checkSite(site, config, options.network)));
  return checks;
}

async function checkSite(site: Site, config: Config, network: boolean): Promise<DoctorCheck[]> {
  const at = (name: string) => `${site.name} ${name}`;
  const checks: DoctorCheck[] = [];

  if (!site.url.startsWith("https://")) {
    return [
      {
        name: at("HTTPS"),
        ok: false,
        detail: `${site.url} is not HTTPS, and WordPress refuses application passwords over plain HTTP`,
        fix: "Serve the site over HTTPS; nothing here will authenticate until it is.",
      },
    ];
  }
  checks.push({ name: at("HTTPS"), ok: true, detail: site.url });

  // A password pasted without its spaces is a real and invisible failure.
  const stripped = site.appPassword.replace(/\s/g, "");
  checks.push(
    stripped.length === 24
      ? { name: at("password"), ok: true, detail: "24 characters, the shape of an application password" }
      : {
          name: at("password"),
          ok: false,
          detail: `${stripped.length} characters ignoring spaces, where WordPress generates 24, so probably a login password`,
          fix: "Generate one at Users > Profile > Application Passwords.",
        },
  );
  if (!network) return checks;

  const client = new WpClient(site, config);
  let me: { name?: string; slug?: string; roles?: string[]; capabilities?: Record<string, boolean> };
  try {
    me = (await client.get("users/me", { context: "edit" })) as typeof me;
  } catch (error) {
    checks.push({ name: at("sign-in"), ok: false, detail: describe(error) });
    return checks;
  }
  checks.push({ name: at("sign-in"), ok: true, detail: `as ${me.name ?? me.slug ?? site.username}${me.roles?.length ? ` (${me.roles.join(", ")})` : ""}` });

  // Role, not password, is the usual cause of a write failing.
  const caps = me.capabilities ?? {};
  checks.push(
    caps.publish_posts
      ? { name: at("publishing"), ok: true, detail: "this user can publish posts" }
      : { name: at("publishing"), ok: false, detail: "this user cannot publish posts, so WordPress will refuse writes", fix: "Use an Editor or Administrator account." },
  );
  if (!caps.edit_others_posts) {
    checks.push({ name: at("reach"), ok: true, warn: true, detail: "this user cannot edit other people's posts, so it only reaches its own content" });
  }
  if (!caps.upload_files) {
    checks.push({ name: at("uploads"), ok: false, detail: "this user cannot upload files, so wp_upload_media will be refused" });
  }

  // The helper plugin is optional, so its absence is reported rather than failed.
  try {
    checks.push(
      (await client.hasHelperPlugin())
        ? { name: at("helper plugin"), ok: true, detail: "installed, so all 42 tools are available" }
        : {
            name: at("helper plugin"),
            ok: false,
            warn: true,
            detail: "not installed: 30 tools work, and the 12 covering Elementor, Rank Math, redirects, protected meta and bulk edits will say so",
            fix: "Copy plugin/mcp-wordpress-helper.php into wp-content/mu-plugins/ to enable them.",
          },
    );
  } catch (error) {
    checks.push({ name: at("helper plugin"), ok: false, warn: true, detail: `could not check: ${describe(error)}` });
  }
  return checks;
}
