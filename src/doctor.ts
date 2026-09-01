/**
 * `wordpress-mcp doctor`: say what is wrong before a tool call has to.
 *
 * Setting this up fails in a small number of predictable ways, and the REST
 * error for each is unhelpful on its own. A site behind a security plugin
 * returns HTML. A site on plain HTTP rejects the application password with a
 * generic 401. A password pasted with the spaces removed fails the same way as
 * a wrong one. An Author account authenticates perfectly and then cannot edit
 * anything.
 *
 * So this walks the chain in order, stops at the first thing that is actually
 * broken, and names the fix. Each site is checked independently, because one
 * misconfigured site among three should not read as the server being broken.
 */

import { WpClient } from "./api/client.js";
import { loadConfig, type Config, type Site } from "./config.js";
import { HelperPluginMissingError, WordPressError } from "./api/errors.js";
import { ALL_TOOLS } from "./tools/index.js";
import { declaredRisk } from "./tools/kit.js";

type Line = { ok: boolean; text: string };

function say(lines: Line[]): void {
  for (const line of lines) {
    process.stdout.write(`${line.ok ? "  ok  " : "  --  "}${line.text}\n`);
  }
}

export async function runDoctor(config: Config = loadConfig()): Promise<number> {
  process.stdout.write("\nwordpress-mcp doctor\n\n");

  if (config.sites.length === 0) {
    process.stdout.write("No WordPress site is configured.\n\n");
    process.stdout.write(
      "Set these in your client's env block, or in the shell before running the server:\n\n" +
        "  WORDPRESS_SITE_URL       https://example.com\n" +
        "  WORDPRESS_USERNAME       your WordPress login name\n" +
        "  WORDPRESS_APP_PASSWORD   from Users > Profile > Application Passwords\n\n" +
        "For several sites, set WORDPRESS_SITES to a JSON array instead:\n\n" +
        '  [{"name":"blog","url":"https://example.com","username":"you","app_password":"xxxx xxxx xxxx xxxx xxxx xxxx"}]\n\n' +
        "The application password is not your login password. Generate one in wp-admin,\n" +
        "and paste it exactly as WordPress shows it, spaces included.\n",
    );
    return 1;
  }

  const writeTools = ALL_TOOLS.filter((t) => declaredRisk(t) !== "read").length;
  process.stdout.write(
    `Configuration\n` +
      `  ${config.sites.length} site${config.sites.length === 1 ? "" : "s"} configured\n` +
      `  ${config.readOnly ? `read-only, so the ${writeTools} write tools are hidden` : "writes enabled"}\n` +
      `  ${config.allowDestructive ? "publishing and permanent deletion allowed with confirm: true" : "publishing and permanent deletion disabled"}\n` +
      `  ${config.auditPath ? `audit log at ${config.auditPath}` : "no audit log"}\n` +
      `  ${config.defaultSite ? `default site: ${config.defaultSite}` : config.sites.length > 1 ? "no default site, so every call must name one" : "single site, named automatically"}\n\n`,
  );

  let failures = 0;

  for (const site of config.sites) {
    process.stdout.write(`${site.name}  ${site.url}\n`);
    const lines = await checkSite(site, config);
    say(lines);
    if (lines.some((l) => !l.ok)) failures += 1;
    process.stdout.write("\n");
  }

  if (failures === 0) {
    process.stdout.write("Everything checks out.\n");
    return 0;
  }
  process.stdout.write(
    `${failures} of ${config.sites.length} site${config.sites.length === 1 ? "" : "s"} needs attention.\n`,
  );
  return 1;
}

async function checkSite(site: Site, config: Config): Promise<Line[]> {
  const lines: Line[] = [];

  // HTTPS first, because WordPress disables application passwords over plain
  // HTTP and the resulting 401 says nothing about why.
  if (!site.url.startsWith("https://")) {
    lines.push({
      ok: false,
      text: "The site URL is not HTTPS. WordPress refuses application passwords over plain HTTP, so nothing here will authenticate until the site is served over HTTPS.",
    });
    return lines;
  }
  lines.push({ ok: true, text: "HTTPS" });

  // A password pasted without its spaces is a real and invisible failure.
  const stripped = site.appPassword.replace(/\s/g, "");
  if (stripped.length === 24 && !site.appPassword.includes(" ")) {
    lines.push({
      ok: true,
      text: "Application password looks right (24 characters, spaces removed, which WordPress accepts)",
    });
  } else if (stripped.length !== 24) {
    lines.push({
      ok: false,
      text: `Application password is ${stripped.length} characters ignoring spaces, where WordPress generates 24. This is probably a login password rather than an application password. Generate one at Users > Profile > Application Passwords.`,
    });
  } else {
    lines.push({ ok: true, text: "Application password looks right (24 characters)" });
  }

  const client = new WpClient(site, config);

  let me: { name?: string; slug?: string; roles?: string[]; capabilities?: Record<string, boolean> };
  try {
    me = (await client.get("users/me", { context: "edit" })) as typeof me;
  } catch (error) {
    lines.push({ ok: false, text: describe(error) });
    return lines;
  }

  lines.push({
    ok: true,
    text: `Authenticated as ${me.name ?? me.slug ?? site.username}${me.roles?.length ? ` (${me.roles.join(", ")})` : ""}`,
  });

  // Role, not password, is the usual cause of a write failing.
  const caps = me.capabilities ?? {};
  if (caps.publish_posts) {
    lines.push({ ok: true, text: "Can publish posts" });
  } else {
    lines.push({
      ok: false,
      text: "This user cannot publish posts. Reads will work and writes will be refused by WordPress. Use an Editor or Administrator account.",
    });
  }
  if (!caps.edit_others_posts) {
    lines.push({
      ok: true,
      text: "Note: this user cannot edit other people's posts, so it only reaches its own content.",
    });
  }
  if (!caps.upload_files) {
    lines.push({ ok: false, text: "This user cannot upload files, so wp_upload_media will be refused." });
  }

  // The helper plugin is optional, so its absence is reported rather than failed.
  try {
    const present = await client.hasHelperPlugin();
    lines.push(
      present
        ? { ok: true, text: "Helper plugin installed, so all 42 tools are available" }
        : {
            ok: true,
            text: "Helper plugin not installed. 30 tools work; the 12 covering Elementor, Rank Math, redirects, protected meta and bulk edits will report it. Copy plugin/mcp-wordpress-helper.php into wp-content/mu-plugins/ to enable them.",
          },
    );
  } catch (error) {
    lines.push({ ok: true, text: `Could not check for the helper plugin: ${describe(error)}` });
  }

  return lines;
}

function describe(error: unknown): string {
  if (error instanceof HelperPluginMissingError) return error.message;
  if (error instanceof WordPressError) return error.message;
  return (error as Error)?.message ?? String(error);
}
