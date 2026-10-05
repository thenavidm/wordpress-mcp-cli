<div align="center">
  <img src="https://cdn.navid.me/connectors/wordpress-icon.png" alt="WordPress" width="88">
</div>

# WordPress MCP Server & CLI

[![npm](https://img.shields.io/npm/v/@thenavidm/wordpress-mcp-cli?color=orange&label=npm)](https://www.npmjs.com/package/@thenavidm/wordpress-mcp-cli)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-@thenavidm-red?logo=youtube&logoColor=white)](https://youtube.com/@thenavidm?sub_confirmation=1)
[![X](https://img.shields.io/badge/X-@thenavidm-black?logo=x)](https://x.com/thenavidm)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thenavidm-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/thenavidm)

WordPress MCP server and CLI for Claude Code, Codex and AI agents. 42 tools for posts, pages, custom post types, media, taxonomies, Elementor, Rank Math SEO, redirects, bulk edits, multi-site.

One install gives you both surfaces, the same 42 tools under the same names.

There is no OAuth app to register and no plugin required: an application password from your own profile screen is the whole setup.

It defaults to drafts. Publishing is the one thing here that cannot be taken back, so it takes a deliberate confirmation.

It also reads the meta fields WordPress hides from its own REST API, which is where Elementor layouts and ACF values actually live.

Built and maintained by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=referral&utm_campaign=wordpress-mcp-cli&utm_content=readme). Built on [Slipway](https://github.com/thenavidm/slipway), which turns one definition of each tool into the MCP server and the CLI.

```
You: Which posts on my blog are missing a meta description?

Claude: Checked the 40 published posts. Eleven have no meta description,
        and these four get the most traffic:

        • "How I plan a launch"        /how-i-plan-a-launch
        • "The tools I actually use"   /tools-i-actually-use
        • "Pricing, honestly"          /pricing-honestly
        • "What I got wrong in 2025"   /what-i-got-wrong-in-2025

        Three more are set to noindex, which looks unintentional:
        two are 2,000-word guides and one is your services page.

        Want me to draft descriptions for the four, or start with the
        noindex on the services page?
```

## Two ways to use it

### Command line

`wordpress-cli` in your terminal, for scripting, cron, pipes, or just asking a
quick question without opening anything:

```bash
wordpress-cli                                   # every command, one line each
wordpress-cli wp-list-posts --status draft --per-page 5
wordpress-cli wp-search "pricing"
wordpress-cli wp-get-post --post-id 42 --select id,title.rendered
wordpress-cli wp-create-post --title "Launch notes" --content "Draft body."
wordpress-cli wp-list-sites --json | jq -r '.sites[].name'
wordpress-cli wp-create-post --title "Live now" --content "…" --status publish --confirm
wordpress-cli <command> --help                  # what any command takes
```

`--confirm` is the shell spelling of the confirmation that publishing, permanent
deletion, replacing an Elementor layout and bulk edits require. `--json` gives
JSON, `--compact` puts it on one line, `--select` keeps only the fields you name,
and errors are JSON on stderr whichever you pick.

`--agent` is compact JSON with no prompts, and it never confirms a write.

Exit codes, so a script can branch without reading prose: `0` ok, `1` an
unexpected error, `2` bad arguments or a hidden or refused write, `3` not found,
`4` auth, `5` the site failed, `7` rate limited, `10` nothing configured, or the
helper plugin or Rank Math missing.

### MCP server, for your AI app

`wordpress-mcp` is what Claude Code, Claude Desktop, Cursor and the rest launch.
You never run it by hand:

```bash
claude mcp add wordpress \
  -e WORDPRESS_SITE_URL=https://example.com \
  -e WORDPRESS_USERNAME=your-wp-username \
  -e "WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx" \
  -- npx -y @thenavidm/wordpress-mcp-cli@latest
```

Then just ask: _"which of my published posts have no meta description?"_

Each publish waits for your approval in the client, as
[section 8](#8-writing-safely-) explains.

Every other client is in [section 4](#4-connect-your-client-).

### Which one

| Where you are | What you can reach |
|---|---|
| An agent that can run shell commands, like Claude Code or Cursor | Both. The CLI is the cheaper one: it costs nothing until you type it |
| claude.ai, the Claude Desktop chat tab, or a phone | The server only. There is no shell to run a command in |
| A terminal, a script, cron or CI | The CLI only. There is no MCP client in a shell |

They are the same program reading the same tool definitions, so anything one can
do, the other can.

## Features

Every tool is both a command and an MCP tool, with the same name. The command
is the tool name with dashes.

| Capability | CLI command | MCP tool |
|---|---|---|
| See which sites and which user | `wordpress-cli wp-list-sites` / `wp-get-me` / `wp-get-settings` | `wp_list_sites` / `wp_get_me` / `wp_get_settings` |
| Find anything | `wordpress-cli wp-search` | `wp_search` |
| Posts and pages | `wordpress-cli wp-list-posts` / `wp-create-post` / `wp-update-post` / `wp-list-pages` | `wp_list_posts` / `wp_create_post` / `wp_update_post` / `wp_list_pages` |
| Custom post types | `wordpress-cli wp-list-post-types` / `wp-list-custom` / `wp-create-custom` | `wp_list_post_types` / `wp_list_custom` / `wp_create_custom` |
| Media | `wordpress-cli wp-list-media` / `wp-upload-media` | `wp_list_media` / `wp_upload_media` |
| Categories, tags and taxonomies | `wordpress-cli wp-list-categories` / `wp-create-category` / `wp-list-taxonomy-terms` | `wp_list_categories` / `wp_create_category` / `wp_list_taxonomy_terms` |
| Users and comments | `wordpress-cli wp-list-users` / `wp-list-comments` | `wp_list_users` / `wp_list_comments` |
| Hidden meta and Elementor, with the helper plugin | `wordpress-cli wp-get-all-meta` / `wp-get-elementor` / `wp-update-elementor` | `wp_get_all_meta` / `wp_get_elementor` / `wp_update_elementor` |
| Rank Math SEO and redirects, with the helper plugin | `wordpress-cli wp-get-rankmath` / `wp-update-rankmath` / `wp-list-redirects` | `wp_get_rankmath` / `wp_update_rankmath` / `wp_list_redirects` |
| Bulk edits, with the helper plugin | `wordpress-cli wp-bulk-update` / `wp-bulk-delete` | `wp_bulk_update` / `wp_bulk_delete` |
| Check your setup | `wordpress-cli doctor` | not a tool |

All 42 are in [section 7](#7-tools-).

## Contents

| # | Section | What is in it |
|---|---|---|
| 1 | [What you can ask it](#1-what-you-can-ask-it-) | Real prompts, not features |
| 2 | [Quick install](#2-quick-install-) | The package, no account needed |
| 3 | [Set up your account](#3-set-up-your-account-) | Every click |
| 4 | [Connect your client](#4-connect-your-client-) | Claude Code, Desktop, Cursor |
| 5 | [Check it worked](#5-check-it-worked-) | `doctor` |
| 6 | [Which surface, and what each costs](#6-which-surface-and-what-each-costs-) | Measured in Claude Code, and how to spend less |
| 7 | [Tools](#7-tools-) | All 42, by what they reach |
| 8 | [Writing safely](#8-writing-safely-) | What is guarded and what is not |
| 9 | [Notes and gotchas](#9-notes-and-gotchas-) | WordPress's real behavior |
| 10 | [Troubleshooting](#10-troubleshooting-) | Symptom to cause |
| 11 | [FAQ](#11-faq-) | Including what an MCP server is |

---

## 1. What you can ask it 💬

- "Draft a post about the launch, file it under Marketing, and leave it as a draft."
- "Which posts are missing a meta description?"
- "Find every page that mentions the old pricing and show me where."
- "Duplicate the services page so I can rewrite it without touching the live one."
- "What custom post types does this site have, and how many items are in each?"
- "Redirect the old blog URL to the new one, permanently."
- "Upload this image, set the alt text, and make it the featured image on post 412."
- "List everything sitting in the moderation queue."
- "Which of my pages are set to noindex?"
- "Move all twelve of last year's event posts to draft."

The thing that is genuinely impossible without this: **reading and writing the meta fields WordPress hides.** Core refuses to expose any meta key beginning with an underscore, at any privilege level. That is where Elementor stores an entire page layout, where ACF stores its field values, and where Rank Math stores its SEO settings. Without the helper plugin included here, none of it is reachable over the API, so an agent looking at an Elementor page sees an empty post and concludes the page is blank.

---

## 2. Quick install ⚡

Node 22 or newer. Nothing else.

    npx -y @thenavidm/wordpress-mcp-cli --version

That is the whole install. `npx` fetches it on demand, so there is nothing to update later.

---

## 3. Set up your account 🔑

The long version, every step with what to do when one fails, is in [INSTALL.md](INSTALL.md).

You need an **application password**. It is not your login password. WordPress has generated these since version 5.6, they are revocable one at a time, and they carry the role of the user they belong to.

Your site has to be served over HTTPS. WordPress disables application passwords over plain HTTP.

### Have an agent do it

The agent cannot sign in to WordPress for you. Only you can create the credential. What it can do is walk you through it, wire up the config, and verify the connection.

Paste this into Claude Code, Cursor, or any agent with terminal access:

    Help me connect my WordPress site to the wordpress-mcp server.

    1. Tell me to open my site's wp-admin and go to Users, then Profile.
    2. Tell me to scroll to the "Application Passwords" section, enter a
       descriptive name such as "Claude MCP", and create one.
    3. Stop and wait. I will paste the generated password back to you.
       Do not continue until I do.
    4. Ask me for my site URL and my WordPress username.
    5. Add the server to my MCP client config with those three values.
    6. Run `npx -y @thenavidm/wordpress-mcp-cli doctor` and tell me what it says.

### Or do it yourself

1. Sign in to your site's `wp-admin` as the user you want the agent to act as.
2. Go to **Users**, then **Profile**. To set one up for a different user, go to **Users**, then **All Users**, and edit that user instead.
3. Scroll to the **Application Passwords** section.
4. Enter a descriptive name, something like `Claude MCP`, and create the password.
5. Copy what WordPress shows you. It is displayed once and never again.

WordPress shows the password in space-separated groups. It works with the spaces or without them, so paste whichever you have.

### Which user to use

The application password carries that user's role exactly. An Author account can only reach its own posts, however the request is phrased.

| Role | What the agent can do |
|---|---|
| Administrator | Everything, including site settings and permanent deletion |
| Editor | Everything to content: publish, edit anyone's posts, upload media |
| Author | Its own posts only |

Editor is enough for almost all of this. Give the agent its own WordPress user rather than reusing your login, and you can revoke it without disturbing anything else.

### The helper plugin

Thirty of the 42 tools work with nothing installed. The other twelve, covering Elementor, Rank Math, redirects, protected meta and bulk edits, need the small plugin in [`plugin/`](./plugin).

Copy `plugin/mcp-wordpress-helper.php` into `wp-content/mu-plugins/` on your site. Files there load automatically, so there is nothing to activate. It registers routes under `wordpress-mcp/v1`, and every route checks the same capabilities WordPress would check itself.

### Revoking

Go back to **Users**, then **Profile**, and revoke the password in the **Application Passwords** section. It stops working immediately, and your login password and every other integration are unaffected.

---

## 4. Connect your client 🔌

### Claude Code

```bash
claude mcp add wordpress \
  -e WORDPRESS_SITE_URL=https://example.com \
  -e WORDPRESS_USERNAME=your-wp-username \
  -e "WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx" \
  -- npx -y @thenavidm/wordpress-mcp-cli@latest
```

`--scope user` makes it available in every project rather than just the current one.

### Claude Desktop

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "npx",
      "args": ["-y", "@thenavidm/wordpress-mcp-cli@latest"],
      "env": {
        "WORDPRESS_SITE_URL": "https://example.com",
        "WORDPRESS_USERNAME": "your-wp-username",
        "WORDPRESS_APP_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

Quit Claude Desktop completely and reopen it.

Or skip the JSON: download `wordpress-<version>.mcpb` from the
[latest release](https://github.com/thenavidm/wordpress-mcp-cli/releases/latest)
and open it. Claude Desktop asks for the site address, the username and the
application password, and carries its own copy of everything it needs.

> [!TIP]
> Claude Desktop does not inherit your shell PATH, so a bare command name fails
> silently. Use the absolute path from `which npx`, and fully quit the app
> rather than closing the window.

### claude.ai on the web

claude.ai runs connectors from Anthropic's cloud, so it cannot launch a local command. It needs a public HTTPS URL.

```bash
npx -y @thenavidm/wordpress-mcp-cli@latest --http --port=8790
```

Either spelling works: `--port=8790` or `--port 8790`. `WORDPRESS_HTTP_PORT`
works too, and the flag wins over the variable.

Host it somewhere with a public HTTPS URL, then in claude.ai: **Customize**, then **Connectors**, then **+**, then **Add custom connector**. Paste the URL and click **Add**.

> [!WARNING]
> Anything that can reach that port can publish to and permanently delete from
> your site without ever seeing the password. Set `WORDPRESS_HTTP_TOKEN` to a
> long random string; the server refuses to bind anything but loopback without
> one. A page from another site is refused unless `WORDPRESS_HTTP_ALLOWED_ORIGINS`
> lists it.

### Cursor

`.cursor/mcp.json`, same JSON shape as Claude Desktop, key `mcpServers`.

### Windsurf

`~/.codeium/windsurf/mcp_config.json`, key `mcpServers`.

### VS Code

`.vscode/mcp.json`. The key is **`servers`**, not `mcpServers`, and each entry takes `"type": "stdio"`.

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.wordpress]
command = "npx"
args = ["-y", "@thenavidm/wordpress-mcp-cli@latest"]

[mcp_servers.wordpress.env]
WORDPRESS_SITE_URL = "https://example.com"
WORDPRESS_USERNAME = "your-wp-username"
WORDPRESS_APP_PASSWORD = "xxxx xxxx xxxx xxxx xxxx xxxx"
```

### Gemini CLI

`~/.gemini/settings.json`, key `mcpServers`.

### Everything else

Any stdio MCP client takes the same three things: the command `npx`, the args, and the env block.

Or let the CLI write the entry, in each client's own format:

```bash
npx -y -p @thenavidm/wordpress-mcp-cli wordpress-cli install claude-code
```

It takes `claude-code`, `codex`, `claude-desktop`, `cursor`, `vscode` or `gemini`, and `--dry-run` shows the change first.

### More than one site

Set `WORDPRESS_SITES` to a JSON array instead of the single-site variables, and every tool takes an optional `site`:

```json
{
  "env": {
    "WORDPRESS_SITES": "[{\"name\":\"blog\",\"url\":\"https://example.com\",\"username\":\"you\",\"app_password\":\"xxxx xxxx xxxx xxxx xxxx xxxx\"},{\"name\":\"shop\",\"url\":\"https://shop.example.com\",\"username\":\"you\",\"app_password\":\"yyyy yyyy yyyy yyyy yyyy yyyy\"}]",
    "WORDPRESS_DEFAULT_SITE": "blog"
  }
}
```

Without `WORDPRESS_DEFAULT_SITE`, a call that does not name a site is refused rather than guessed at.

---

## 5. Check it worked 🩺

    npx -y @thenavidm/wordpress-mcp-cli doctor

It walks the chain in order and stops at the first thing actually broken: HTTPS, then the shape of the password, then authentication, then the user's role, then whether the helper plugin is installed.

The two that come up most:

- **"12 characters ignoring spaces, where WordPress generates 24."** That is a login password. Application passwords are 24 characters and are generated in the **Application Passwords** section of the profile screen.
- **"this user cannot publish posts."** The credential is fine and the role is too low. Use an Editor or Administrator account.

---

## 6. Which surface, and what each costs 💸

Both surfaces are the same program with the same 42 tools. The
difference is when the model pays for them. Measured in Claude Code:

| Cost | MCP server | CLI |
|---|---|---|
| Every message, with every tool loaded | 21,400 tokens | nothing |
| Every message, Claude Code's default | 1,300 tokens | nothing |
| When WordPress comes up | nothing more, or the tools it picks | 4,000 tokens for `SKILL.md`, once |
| 20 messages with WordPress in 1, every tool loaded | 428,000 tokens | 4,000 tokens |

Claude Code's [tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search)
is on by default: it sends only the tool names and the server instructions,
and loads a tool's full definition when the model reaches for it. An app that
loads every tool up front pays the first line on every message, whether
WordPress comes up or not. With the skill added, Claude Code also lists its
one-line description, about 150 tokens.

Where the tokens go, with every tool loaded:

| Part of the tool list | Share |
|---|---|
| Structure: names, types, required lists, nesting, annotations | 49% |
| Argument descriptions | 32% |
| Tool descriptions | 19% |

To spend less, turn the server off when you are not using it, which in Claude
Code is the `/mcp` panel. `WORDPRESS_READ_ONLY=1` takes the 20 write tools off the list, leaving 22,
and on a site without the helper plugin `WORDPRESS_TOOLSETS=core` leaves out the twelve that need it.
Or install the CLI and add the server on the days it earns its place.

Measured on 2026-10-05 with Claude Code 2.1.286 on Claude Opus 5.5: one
short prompt with and without the server connected, once with
`ENABLE_TOOL_SEARCH=false` and once with the default, the difference read
from the API's own usage figures. `SKILL.md` was measured the same way. Other
apps and models count tokens a little differently.

Against 1.1.3, measured the same day: every tool loaded costs 21,418 tokens
instead of 23,263, tool search the same within 2 tokens (1,330 against 1,328,
one of them for American spelling in the server instructions), and `SKILL.md`
82 more, because it now says how approval works over MCP and lists every exit
code. In Codex 0.159.3 on gpt-6.1-sol, the same task, "find the command that
sets a post's Rank Math SEO title and meta description, and the flags it
requires", read a median of 83,568 input tokens on 2.0.0 against 84,368 on
1.1.3 over the CLI, five runs each: Codex now asks `which` instead of reading
the full command list. Over MCP, Codex prints the tool list with a script and
cuts the printout to about 10,000 tokens, so it read about 9,600 on both
versions, out of a full listing of 40,174 tokens on 2.0.0 against 40,531. The
input totals, a median of 48,498 against 48,386, also carry the model's
reasoning into its second request, which three of the five 2.0.0 runs did and
none of the 1.1.3 runs; the two 2.0.0 runs that did not read 48,419 and 48,392.

## 7. Tools 🛠️

Thirty need nothing installed. The twelve marked 🔌 need the [helper plugin](./plugin), and `wordpress-cli` lists them under their own heading. On a site without it, `WORDPRESS_TOOLSETS=core` leaves them off the list.

**Sites and identity**

| Tool | What it does |
|---|---|
| `wp_list_sites` | Every configured site, its short name, and whether the plugin is there |
| `wp_get_me` | The user the password belongs to, and its capabilities |
| `wp_get_settings` | Title, tagline, timezone, date formats, default category |

**Finding things**

| Tool | What it does |
|---|---|
| `wp_search` | One search across every searchable post type and term |

**Posts**

| Tool | What it does |
|---|---|
| `wp_list_posts` | Filter by status, search, category, tag, author, date range |
| `wp_get_post` | One post, raw rather than rendered |
| `wp_create_post` | Create, draft by default |
| `wp_update_post` | Change only the fields passed |
| `wp_delete_post` | Trash, or permanently delete with `force` |
| 🔌 `wp_duplicate_post` | Copy a post with all its meta, as a draft |

**Pages**

| Tool | What it does |
|---|---|
| `wp_list_pages` | Filter by status, search, parent, slug |
| `wp_create_page` | Create, with optional parent for nesting |
| `wp_update_page` | Change only the fields passed |

**Custom post types**

| Tool | What it does |
|---|---|
| `wp_list_post_types` | Every registered type and its REST base |
| `wp_list_custom` | List items of any type |
| `wp_get_custom` | One item |
| `wp_create_custom` | Create an item |
| `wp_update_custom` | Update an item |
| `wp_delete_custom` | Trash or delete an item |

**Media**

| Tool | What it does |
|---|---|
| `wp_list_media` | Filter by search, MIME type, or attached post |
| `wp_get_media` | One attachment, with every generated size |
| `wp_upload_media` | Upload from a URL, then set title, alt text and caption |
| `wp_delete_media` | Delete an attachment and its generated sizes |

**Categories, tags and taxonomies**

| Tool | What it does |
|---|---|
| `wp_list_categories` | With IDs and post counts |
| `wp_create_category` | Create one and return its ID |
| `wp_list_tags` | With IDs and post counts |
| `wp_create_tag` | Create one and return its ID |
| `wp_list_taxonomies` | Every taxonomy and its REST base |
| `wp_list_taxonomy_terms` | Terms in any taxonomy |

**People**

| Tool | What it does |
|---|---|
| `wp_list_users` | Users, with roles where visible |
| `wp_list_comments` | Comments, including the moderation queue |

**The fields core hides**

| Tool | What it does |
|---|---|
| 🔌 `wp_get_all_meta` | Every meta field, including underscore-prefixed |
| 🔌 `wp_update_meta` | Write meta fields, including protected keys |
| 🔌 `wp_get_elementor` | The Elementor widget tree for a page |
| 🔌 `wp_update_elementor` | Replace the Elementor widget tree |

**SEO**

| Tool | What it does |
|---|---|
| 🔌 `wp_get_rankmath` | Every Rank Math field set on a post |
| 🔌 `wp_update_rankmath` | Titles, descriptions, robots, canonical, OG, Twitter |
| 🔌 `wp_list_redirects` | Redirects with sources, destinations and codes |
| 🔌 `wp_create_redirect` | 301, 302, 307, 410 or 451 |
| 🔌 `wp_delete_redirect` | Remove a redirect |

**Bulk**

| Tool | What it does |
|---|---|
| 🔌 `wp_bulk_update` | Same change across a list of posts |
| 🔌 `wp_bulk_delete` | Trash or delete a list of posts |

---

## 8. Writing safely 🛟

Writes work by default. Publishing is the point of the tool.

Four things wait for your approval, because they are the ones WordPress cannot undo: **publishing or scheduling**, which reaches feeds and mailing lists within minutes; **permanent deletion**, meaning `force: true`; **replacing an Elementor layout**, which overwrites the whole page in one field; and **anything bulk**, where a wrong list is a wrong set of pages.

Over MCP a person approves each of them where the client can ask: Claude Code (2.1.246 and later) shows its own prompt, and a client that can show forms asks with an approval form whose one box starts unticked. Each approval is signed, bound to that exact call and works once. Where a client can do neither, the model's `confirm: true` counts, and it should pass it only when you asked for that exact action. `WORDPRESS_CONFIRM=model` makes `confirm: true` enough everywhere, for an agent with no person to ask. In a terminal it is `--confirm`, which `--agent` never adds.

Trashing, drafting and ordinary edits are not guarded. Each is one click to undo in wp-admin, and approving everything would train the reflex the approval exists to prevent.

`WORDPRESS_READ_ONLY=1` removes all 20 write tools from the list. `WORDPRESS_ALLOW_DESTRUCTIVE=0` keeps ordinary writes and refuses publishing and permanent deletion. `WORDPRESS_AUDIT_LOG=<path>` records every attempted write, allowed and blocked alike, and who approved it.

### Every environment variable

**Credentials.** Both surfaces read the same ones, so a shell that can run
`wordpress-cli` needs nothing beyond what the MCP server already has.

| Variable | Default | What it does |
|---|---|---|
| `WORDPRESS_SITES` | none | JSON array of sites, for several at once. Takes priority over the single-site variables below. |
| `WORDPRESS_SITE_URL` | none | The site, for the single-site case, e.g. `https://example.com`. |
| `WORDPRESS_USERNAME` | none | The WordPress login name the application password belongs to. |
| `WORDPRESS_APP_PASSWORD` | none | From Users > Profile > Application Passwords. Not the login password. |
| `WORDPRESS_SITE_NAME` | the hostname | The short label for that single site. |
| `WORDPRESS_DEFAULT_SITE` | none | Which site acts when a call names none. Without it, a call that names none is refused rather than guessed at. |

**Safety.** They apply identically to both surfaces, because both go through
Slipway's one guard.

| Variable | Default | What it does |
|---|---|---|
| `WORDPRESS_READ_ONLY` | off | `1` removes all 20 write tools from the list, rather than refusing them at call time. |
| `WORDPRESS_ALLOW_DESTRUCTIVE` | on | `0` keeps ordinary writes and blocks publishing and permanent deletion. |
| `WORDPRESS_AUDIT_LOG` | none | Path to an append-only log of every attempted write, allowed and blocked alike, and who approved it. |
| `WORDPRESS_CONFIRM` | `human` | `model` lets `confirm: true` alone approve over MCP, for an agent with no person to ask. |
| `WORDPRESS_TOOLSETS` | `all` | `core` leaves out the twelve tools that need the helper plugin. |

**Tuning.**

| Variable | Default | What it does |
|---|---|---|
| `WORDPRESS_REQUEST_TIMEOUT_MS` | `30000` | Per-request deadline. |
| `WORDPRESS_MAX_RETRIES` | `2` | Retries on rate limits and 5xx. Reads only, never writes: a retried POST on a flaky connection is how a post gets published twice. |
| `WORDPRESS_USER_AGENT` | `wordpress-mcp` | Override the User-Agent sent to the site. Some hosts filter on it. |
| `WORDPRESS_HTTP_PORT` | `8790` | Port for `--http`. |
| `WORDPRESS_HTTP_HOST` | `127.0.0.1` | Interface for `--http`. |
| `WORDPRESS_HTTP_TOKEN` | none | Bearer token required by the HTTP transport. Without it, `--http` refuses to bind anything but loopback. |
| `WORDPRESS_HTTP_ALLOWED_ORIGINS` | none | Comma-separated browser origins allowed to connect; a page from any other site is refused. |
| `WORDPRESS_SURFACE` | `full` | `search` lists three tools that find, describe and run the rest. |
| `WORDPRESS_TOOL_TIMEOUT_MS` | none | Give up on any tool after this long. |
| `WORDPRESS_DEBUG` | `0` | `1` prints debug lines on stderr. |

---

## 9. Notes and gotchas ⚠️

- **Publishing is the only irreversible act on a WordPress site.** Feeds, mailing list plugins and social auto-posters read a published post within minutes. Setting the status back to draft removes the page and recalls nothing.
- **An Elementor page ignores its own post content.** The layout is a single serialized JSON tree in `_elementor_data`. Editing such a page with `wp_update_page` writes a field nothing renders, and creating one leaves a page that opens blank in the builder. Duplicate an existing page instead.
- **WordPress hides most meta from its own REST API.** Any key beginning with an underscore is refused outright, and any key not registered with `show_in_rest` is ignored. The `meta` argument on the post tools reaches a small subset; `wp_get_all_meta` reaches the rest.
- **Posts take IDs, never names.** There is no endpoint that accepts a category called "Marketing". Look it up first.
- **Custom post types are addressed by REST base**, which often differs from the label in wp-admin and sometimes from the slug. A type registered without `show_in_rest` cannot be reached over the API at all, however it is addressed.
- **List endpoints return counts in headers, not the body.** These tools fold `X-WP-Total` and `X-WP-TotalPages` in, so ten results out of four hundred say so instead of reading as the whole set.
- **Dates are interpreted in the site's timezone**, not yours. `wp_get_settings` reports it. Getting this wrong schedules a post hours from where it was meant.
- **Application passwords need HTTPS.** WordPress disables them over plain HTTP, and the resulting 401 says nothing about why.
- **A security plugin in front of the REST API answers with HTML.** The error will say so rather than reporting a JSON parse failure, but the fix is in that plugin's settings, not here.
- **Redirects are not meta.** Rank Math keeps them in its own database table, which is why listing them needs the helper plugin rather than a clever query.

---

## 10. Troubleshooting 🔧

Run `npx -y @thenavidm/wordpress-mcp-cli doctor` first. It names the first broken thing rather than the last.

| Symptom | Cause |
|---|---|
| `incorrect_password` on every call | A login password was used instead of an application password, or the site is on plain HTTP |
| `rest_cannot_edit` on some posts, not others | The user is an Author, which reaches only its own posts. Use Editor or Administrator |
| `rest_no_route` | The REST API is disabled or restricted by a security plugin, or the post type lacks `show_in_rest` |
| "needs the WordPress MCP Helper plugin" | One of the twelve 🔌 tools was called on a site without the plugin in `mu-plugins/`. It exits 10 |
| "returned HTML rather than a REST response" | A firewall, security plugin or maintenance page answered instead of WordPress |
| "will not run without --confirm" | Working as intended. The call publishes, deletes permanently, replaces a layout, or is bulk. See [section 8](#8-writing-safely-) |
| `claude -p` will not publish | Headless Claude Code refuses tools that need a person. Give that agent `WORDPRESS_CONFIRM=model` |
| No approval form appears | The client cannot show forms, so the model's `confirm: true` counts, and only for an action you asked for |
| A piped request gets no answer | Stdin closed before the answer. The MCP stdio binding stops a server when its input ends; keep stdin open until you read the answer, or use the CLI |
| Edits to an Elementor page do nothing | The layout is in meta, not post content. Use `wp_get_elementor` and `wp_update_elementor` |
| "did not say which one to use" | Several sites are configured. Pass `site`, or set `WORDPRESS_DEFAULT_SITE` |
| A post scheduled at the wrong hour | Dates use the site's timezone. Check `wp_get_settings` |

---

## 11. FAQ ❓

<details>
<summary><b>What is an MCP server?</b></summary>

An MCP server is a standard way to give an AI assistant real access to a tool,
so it can act rather than guess. You install it once, your assistant gains the
tools, and it works in Claude, Cursor, ChatGPT and anything else speaking MCP.

</details>

<details>
<summary><b>What is the CLI?</b></summary>

`wordpress-cli` is the same program as the MCP server, run as commands. AI agents that run commands, like Claude Code, Codex and OpenCode, use it on their own, and you can type the same commands in a terminal, a script or a cron job. Every tool is a command with dashes, so `wp_list_sites` runs as `wordpress-cli wp-list-sites`.

</details>

<details>
<summary><b>Should I use the MCP server or the CLI?</b></summary>

Use the MCP server in an app with no terminal, like Claude Desktop's chat. Use the CLI anywhere commands run: an agent like Claude Code, Codex or OpenCode, a script or a cron job. The MCP server's tools take up context on every message, and the CLI costs nothing until it runs.

</details>

<details>
<summary><b>What is WordPress?</b></summary>

WordPress is the content management system behind a large share of the web. It
runs on your own server, stores your content in your own database, and exposes
a REST API at `/wp-json/` that this server talks to.

</details>

<details>
<summary><b>Do I need to be technical?</b></summary>

You need to be able to open your site's admin screen and copy a password. The
agent prompt in section 3 handles the rest, including editing the config file.
Installing the optional helper plugin means copying one file into a folder on
your site, which is a file manager or FTP job rather than a coding one.

</details>

<details>
<summary><b>Is my data sent anywhere?</b></summary>

Your credentials go to your own WordPress site and nowhere else. The server runs
on your machine, talks directly to your site's REST API, and has no backend of
its own. Content you ask about reaches whichever AI assistant you are using,
exactly as if you had pasted it into the chat.

</details>

<details>
<summary><b>What can it do that wp-admin cannot?</b></summary>

It can read and write the meta fields WordPress hides from its own REST API,
which is where Elementor layouts and ACF values live, and it can work across
several sites in one conversation. Everything else it does, you could do by
hand. The difference is that it does it in one sentence rather than forty
clicks.

</details>

<details>
<summary><b>Can it publish something by accident?</b></summary>

It cannot publish without being told to twice. Creating a post defaults to
draft, and setting the status to publish or future waits for your approval:
Claude Code shows its own prompt, a client that can show forms asks with one,
and elsewhere the model has to pass `confirm: true` deliberately after reading a
description explaining why. Setting `WORDPRESS_ALLOW_DESTRUCTIVE=0` removes the
possibility entirely while leaving drafts working.

</details>

<details>
<summary><b>Can it delete something by accident?</b></summary>

It can trash a post without confirmation, and trash restores in one click from
wp-admin. Permanent deletion, meaning `force: true`, waits for your approval. Media is the exception worth knowing: WordPress does not trash
attachments, so deleting one is immediate and permanent, and that tool always
confirms.

</details>

<details>
<summary><b>Does it cost anything?</b></summary>

It costs nothing. It is MIT licensed, it uses the REST API already built into
your WordPress site, and there is no account, no API key and no service in the
middle.

</details>

<details>
<summary><b>Does it work with ChatGPT and Cursor?</b></summary>

It works with any client that speaks MCP, which includes Cursor, Windsurf,
VS Code, Codex CLI and Gemini CLI. Section 4 has the config for each. For
claude.ai on the web you need the HTTP transport and somewhere to host it,
because the web app cannot launch a program on your machine.

</details>

<details>
<summary><b>Can I connect more than one site?</b></summary>

You can connect as many as you like through `WORDPRESS_SITES`, and every tool
takes an optional `site` naming which one to act on. When several are configured
and no default is set, a call that does not name one is refused rather than
guessed at, because publishing to a client's site instead of your own is not a
mistake worth risking to save a word.

</details>

<details>
<summary><b>What happens when the password expires?</b></summary>

Application passwords do not expire. They last until you revoke them, which you
do individually in the **Application Passwords** section of your profile screen.
Revoking one stops that integration and leaves your login password and every
other integration untouched.

</details>

<details>
<summary><b>How do I disconnect it?</b></summary>

Revoke the application password in wp-admin, and remove the server from your
client's config. Nothing is left behind on your site except the helper plugin,
if you installed it, which you can delete from `mu-plugins/` at any time. The
tools that depend on it stop working; the other thirty carry on.

</details>

---

## Questions

Run into a problem or have a question? [Open an issue](https://github.com/thenavidm/wordpress-mcp-cli/issues) and I will help.

## About the author

Navid Moazzez is a leading AI business strategist, and the host of the AI Creator Summit, watched by 100,000+ creators. He helps creators and founders master AI and build their own AI Operating System (AI OS) to automate their business and life. He creates useful free tools, MCP servers and CLIs that creators and founders can use in their own workflows.

**Links**

- Personal website: [navid.me](https://navid.me)
- Link in bio: [navid.bio](https://navid.bio)
- Navid Media: [navid.media](https://navid.media)
- YouTube: [@thenavidm](https://youtube.com/@thenavidm?sub_confirmation=1) and [@thenavidai](https://youtube.com/@thenavidai?sub_confirmation=1)
- X: [@thenavidm](https://x.com/thenavidm)
- Instagram: [@thenavidm](https://instagram.com/thenavidm)
- LinkedIn: [thenavidm](https://linkedin.com/in/thenavidm)

If this is useful, star the repo and come say hi on [X](https://x.com/thenavidm).

## Dependencies

| Library | License | What it does |
|---|---|---|
| [Slipway](https://github.com/thenavidm/slipway) | Apache-2.0 | The MCP server and the CLI from one definition of each tool, with the write guard |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Apache-2.0 | The MCP protocol, stdio and streamable HTTP transports, through Slipway |
| [zod](https://github.com/colinhacks/zod) | MIT | Validates every tool argument before it reaches WordPress |

## License

[MIT](./LICENSE). Free to use, modify, and share.

The helper plugin in [`plugin/`](./plugin) is [GPL-2.0-or-later](./plugin/LICENSE), as WordPress plugins are.

Not affiliated with, endorsed by, or sponsored by the WordPress Foundation, Elementor Ltd, or Rank Math. WordPress, Elementor and Rank Math are trademarks of their respective owners.

---

© 2026 [Navid Media](https://navid.media?utm_source=github&utm_medium=referral&utm_campaign=wordpress-mcp-cli&utm_content=readme). Made with ❤️ by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=referral&utm_campaign=wordpress-mcp-cli&utm_content=readme).
