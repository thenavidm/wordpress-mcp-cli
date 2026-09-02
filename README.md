<div align="center">
  <img src="https://cdn.navid.media/shared/tool-logos/wordpress.jpg" alt="WordPress" width="88">
</div>

# WordPress MCP

[![npm](https://img.shields.io/npm/v/@thenavidm/wordpress-mcp?color=orange&label=npm)](https://www.npmjs.com/package/@thenavidm/wordpress-mcp)
[![Licence](https://img.shields.io/badge/licence-MIT-green)](./LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-@thenavidm-red?logo=youtube&logoColor=white)](https://youtube.com/@thenavidm?sub_confirmation=1)
[![X](https://img.shields.io/badge/X-@thenavidm-black?logo=x)](https://x.com/thenavidm)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thenavidm-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/thenavidm)

WordPress MCP server for Claude Code and AI agents. Posts, pages, custom post types, media, taxonomies, Elementor, Rank Math SEO, redirects, bulk edits, multi-site.

It gives an agent real access to your WordPress sites over the REST API, using an application password rather than an OAuth app or a plugin.

It defaults to drafts. Publishing is the one thing here that cannot be taken back, so it takes a deliberate confirmation.

42 tools. It reads the meta fields WordPress hides from its own REST API, which is where Elementor layouts and ACF values actually live.

Built and maintained by [Navid Moazzez](https://navid.me).

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

## Contents

| | Section | |
|---|---|---|
| 1 | [What you can ask it](#1-what-you-can-ask-it-) | Real prompts, not features |
| 2 | [Quick install](#2-quick-install-) | The package, no account needed |
| 3 | [Set up your account](#3-set-up-your-account-) | Every click |
| 4 | [Connect your client](#4-connect-your-client-) | Claude Code, Desktop, Cursor |
| 5 | [Check it worked](#5-check-it-worked-) | `doctor` |
| 6 | [Tools](#6-tools-) | All 42, by what they reach |
| 7 | [Writing safely](#7-writing-safely-) | What is guarded and what is not |
| 8 | [Notes and gotchas](#8-notes-and-gotchas-) | WordPress's real behaviour |
| 9 | [Troubleshooting](#9-troubleshooting-) | Symptom to cause |
| 10 | [FAQ](#10-faq-) | Including what an MCP server is |

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

Node 20 or newer. Nothing else.

    npx -y @thenavidm/wordpress-mcp --version

That is the whole install. `npx` fetches it on demand, so there is nothing to update later.

---

## 3. Set up your account 🔑

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
    6. Run `npx -y @thenavidm/wordpress-mcp doctor` and tell me what it says.

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
  -- npx -y @thenavidm/wordpress-mcp@latest
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
      "args": ["-y", "@thenavidm/wordpress-mcp@latest"],
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

> [!TIP]
> Claude Desktop does not inherit your shell PATH, so a bare command name fails
> silently. Use the absolute path from `which npx`, and fully quit the app
> rather than closing the window.

### claude.ai on the web

claude.ai runs connectors from Anthropic's cloud, so it cannot launch a local command. It needs a public HTTPS URL.

```bash
npx -y @thenavidm/wordpress-mcp@latest --http --port 8790
```

Host it somewhere with a public HTTPS URL, then in claude.ai: **Customize**, then **Connectors**, then **+**, then **Add custom connector**. Paste the URL and click **Add**.

> [!WARNING]
> Anything that can reach that port can publish to and permanently delete from
> your site without ever seeing the password. Set `WORDPRESS_HTTP_TOKEN` to a
> long random string; the server refuses to bind anything but loopback without
> one.

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
args = ["-y", "@thenavidm/wordpress-mcp@latest"]

[mcp_servers.wordpress.env]
WORDPRESS_SITE_URL = "https://example.com"
WORDPRESS_USERNAME = "your-wp-username"
WORDPRESS_APP_PASSWORD = "xxxx xxxx xxxx xxxx xxxx xxxx"
```

### Gemini CLI

`~/.gemini/settings.json`, key `mcpServers`.

### Everything else

Any stdio MCP client takes the same three things: the command `npx`, the args, and the env block.

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

    npx -y @thenavidm/wordpress-mcp doctor

It walks the chain in order and stops at the first thing actually broken: HTTPS, then the shape of the password, then authentication, then the user's role, then whether the helper plugin is installed.

The two that come up most:

- **"Application password is 12 characters ignoring spaces."** That is a login password. Application passwords are 24 characters and are generated in the **Application Passwords** section of the profile screen.
- **"Authenticated as … Can publish posts: no."** The credential is fine and the role is too low. Use an Editor or Administrator account.

---

## 6. Tools 🛠️

Thirty need nothing installed. The twelve marked 🔌 need the [helper plugin](./plugin).

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

## 7. Writing safely 🛟

Writes work by default. Publishing is the point of the tool.

Four things take `confirm: true`, because they are the ones WordPress cannot undo: **publishing or scheduling**, which reaches feeds and mailing lists within minutes; **permanent deletion**, meaning `force: true`; **replacing an Elementor layout**, which overwrites the whole page in one field; and **anything bulk**, where a wrong list is a wrong set of pages.

Trashing, drafting and ordinary edits are not guarded. Each is one click to undo in wp-admin, and confirming everything would train the reflex the confirmation exists to prevent.

`WORDPRESS_READ_ONLY=1` removes all 20 write tools from the list. `WORDPRESS_ALLOW_DESTRUCTIVE=0` keeps ordinary writes and blocks publishing and permanent deletion. `WORDPRESS_AUDIT_LOG=<path>` records every attempted write, allowed and blocked alike.

---

## 8. Notes and gotchas ⚠️

- **Publishing is the only irreversible act on a WordPress site.** Feeds, mailing list plugins and social auto-posters read a published post within minutes. Setting the status back to draft removes the page and recalls nothing.
- **An Elementor page ignores its own post content.** The layout is a single serialised JSON tree in `_elementor_data`. Editing such a page with `wp_update_page` writes a field nothing renders, and creating one leaves a page that opens blank in the builder. Duplicate an existing page instead.
- **WordPress hides most meta from its own REST API.** Any key beginning with an underscore is refused outright, and any key not registered with `show_in_rest` is ignored. The `meta` argument on the post tools reaches a small subset; `wp_get_all_meta` reaches the rest.
- **Posts take IDs, never names.** There is no endpoint that accepts a category called "Marketing". Look it up first.
- **Custom post types are addressed by REST base**, which often differs from the label in wp-admin and sometimes from the slug. A type registered without `show_in_rest` cannot be reached over the API at all, however it is addressed.
- **List endpoints return counts in headers, not the body.** These tools fold `X-WP-Total` and `X-WP-TotalPages` in, so ten results out of four hundred say so instead of reading as the whole set.
- **Dates are interpreted in the site's timezone**, not yours. `wp_get_settings` reports it. Getting this wrong schedules a post hours from where it was meant.
- **Application passwords need HTTPS.** WordPress disables them over plain HTTP, and the resulting 401 says nothing about why.
- **A security plugin in front of the REST API answers with HTML.** The error will say so rather than reporting a JSON parse failure, but the fix is in that plugin's settings, not here.
- **Redirects are not meta.** Rank Math keeps them in its own database table, which is why listing them needs the helper plugin rather than a clever query.

---

## 9. Troubleshooting 🔧

Run `npx -y @thenavidm/wordpress-mcp doctor` first. It names the first broken thing rather than the last.

| Symptom | Cause |
|---|---|
| `incorrect_password` on every call | A login password was used instead of an application password, or the site is on plain HTTP |
| `rest_cannot_edit` on some posts, not others | The user is an Author, which reaches only its own posts. Use Editor or Administrator |
| `rest_no_route` | The REST API is disabled or restricted by a security plugin, or the post type lacks `show_in_rest` |
| "needs the WordPress MCP Helper plugin" | One of the twelve 🔌 tools was called on a site without the plugin in `mu-plugins/` |
| "returned HTML rather than a REST response" | A firewall, security plugin or maintenance page answered instead of WordPress |
| "will not run without confirm: true" | Working as intended. The call publishes, deletes permanently, replaces a layout, or is bulk |
| Edits to an Elementor page do nothing | The layout is in meta, not post content. Use `wp_get_elementor` and `wp_update_elementor` |
| "did not say which one to use" | Several sites are configured. Pass `site`, or set `WORDPRESS_DEFAULT_SITE` |
| A post scheduled at the wrong hour | Dates use the site's timezone. Check `wp_get_settings` |

---

## 10. FAQ ❓

<details>
<summary><b>What is an MCP server?</b></summary>

An MCP server is a standard way to give an AI assistant real access to a tool,
so it can act rather than guess. You install it once, your assistant gains the
tools, and it works in Claude, Cursor, ChatGPT and anything else speaking MCP.

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
draft, and setting the status to publish or future is refused unless the call
also carries `confirm: true`, which the model has to add deliberately after
reading a description explaining why. Setting `WORDPRESS_ALLOW_DESTRUCTIVE=0`
removes the possibility entirely while leaving drafts working.

</details>

<details>
<summary><b>Can it delete something by accident?</b></summary>

It can trash a post without confirmation, and trash restores in one click from
wp-admin. Permanent deletion, meaning `force: true`, is refused without
`confirm: true`. Media is the exception worth knowing: WordPress does not trash
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

Run into a problem or have a question? [Open an issue](https://github.com/navidmoazzez/wordpress-mcp/issues) and I will help.

## About the author 👋

Navid Moazzez is a leading AI business strategist, and the host of the AI Creator Summit, watched by 100,000+ creators. He helps creators and founders master AI and build their own AI Operating System (AI OS) to automate their business and life. This WordPress MCP server is one piece of that system.

**Links**

- Personal website: [navid.me](https://navid.me)
- Store: [navid.bio](https://navid.bio)
- Navid Media: [navid.media](https://navid.media)
- YouTube: [@thenavidm](https://youtube.com/@thenavidm?sub_confirmation=1) and [@thenavidai](https://youtube.com/@thenavidai?sub_confirmation=1)
- X: [@thenavidm](https://x.com/thenavidm)
- Instagram: [@thenavidm](https://instagram.com/thenavidm)
- LinkedIn: [thenavidm](https://linkedin.com/in/thenavidm)

## Dependencies

| Library | Licence | What it does |
|---|---|---|
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MIT | The MCP protocol, stdio and HTTP transports |
| [zod](https://github.com/colinhacks/zod) | MIT | Validates every tool argument before it reaches WordPress |

## License

[MIT](./LICENSE). Free to use, modify, and share.

The helper plugin in [`plugin/`](./plugin) is [GPL-2.0-or-later](./plugin/LICENSE), as WordPress plugins are.

Not affiliated with, endorsed by, or sponsored by the WordPress Foundation, Elementor Ltd, or Rank Math. WordPress, Elementor and Rank Math are trademarks of their respective owners.

---

© 2026 [NM Media](https://navid.media). Made with ❤️ by [Navid Moazzez](https://navid.me).
