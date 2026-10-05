/**
 * The WordPress app: everything Slipway needs to ship the MCP server and the CLI.
 *
 * This file only describes. It never starts anything, so `slipway check` and
 * tests can import it; `index.ts` is what runs.
 */

import { createRequire } from "node:module";
import { slipway } from "@thenavidm/slipway";
import { WpClient } from "./api/client.js";
import { loadConfig } from "./config.js";
import { doctor } from "./doctor.js";
import { INSTRUCTIONS, PROMPTS, RESOURCES } from "./guide.js";
import { ALL_TOOLS } from "./tools/index.js";
import { makeContext, type ToolContext } from "./tools/kit.js";

const require = createRequire(import.meta.url);
export const VERSION: string = (require("../package.json") as { version: string }).version;

export const app = slipway<ToolContext>({
  name: "wordpress",
  title: "WordPress",
  version: VERSION,
  package: "@thenavidm/wordpress-mcp-cli",
  description: "WordPress sites you run: posts, pages, custom post types, media, terms, users and comments, plus Elementor, Rank Math, redirects and bulk edits",
  instructions: INSTRUCTIONS,
  context: (env) => {
    const config = loadConfig(env);
    return makeContext((site) => new WpClient(site, config), config);
  },
  configured: ({ config }) => config.sites.length > 0,
  // The password as configured, without its spaces, and inside the Basic header the client sends.
  secrets: ({ config }) =>
    config.sites.flatMap((site) => [
      site.appPassword,
      site.appPassword.replace(/\s/g, ""),
      Buffer.from(`${site.username}:${site.appPassword}`).toString("base64"),
    ]),
  tools: ALL_TOOLS,
  toolsets: {
    core: "work on any site",
    helper: "need the helper plugin on the site",
  },
  resources: [
    {
      name: "wordpress-sites",
      uri: "wordpress://sites",
      mimeType: "application/json",
      read: ({ config }) => ({
        sites: config.sites.map((site) => ({ name: site.name, url: site.url, username: site.username })),
        default_site: config.defaultSite,
        read_only: config.readOnly,
        destructive_allowed: config.allowDestructive,
      }),
    },
    ...RESOURCES.map(({ text, ...resource }) => ({ ...resource, read: () => text })),
  ],
  prompts: PROMPTS.map(({ text, ...prompt }) => ({ ...prompt, render: () => text })),
  httpPort: 8790,
  doctor,
  // HTTP, a pasted login password and an Author account all fail as the same 401 or 403, so doctor signs in to each site every time, as 1.1 did.
  doctorNetwork: true,
  login:
    "Generate an application password in wp-admin, at Users > Profile > Application Passwords, and set WORDPRESS_SITE_URL, WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD, or WORDPRESS_SITES for several sites. Run `wordpress-cli doctor` to check it.",
  settings: [
    { env: "WORDPRESS_SITES", description: "Several sites, as a JSON array of objects with name, url, username and app_password.", secret: true },
    { env: "WORDPRESS_SITE_URL", description: "One site, such as https://example.com." },
    { env: "WORDPRESS_USERNAME", description: "Your WordPress login name." },
    { env: "WORDPRESS_APP_PASSWORD", description: "From Users > Profile > Application Passwords, not your login password.", secret: true },
    { env: "WORDPRESS_SITE_NAME", description: "The short name for that one site; its hostname when unset.", tuning: true },
    { env: "WORDPRESS_DEFAULT_SITE", description: "Which site acts when a call names none.", tuning: true },
    { env: "WORDPRESS_REQUEST_TIMEOUT_MS", description: "Each request's deadline; 30000 when unset.", tuning: true },
    { env: "WORDPRESS_MAX_RETRIES", description: "Retries on rate limits and 5xx; 2 when unset.", tuning: true },
    { env: "WORDPRESS_USER_AGENT", description: "The User-Agent sent to the site.", tuning: true },
  ],
  links: { repository: "https://github.com/thenavidm/wordpress-mcp-cli" },
});
