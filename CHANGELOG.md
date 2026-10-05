# WordPress MCP Server & CLI changelog

| Component | Version |
|---|---|
| wordpress-mcp-cli | 2.0.0 |
| Slipway | ^0.1.17 |
| MCP TypeScript SDK, through Slipway | 2.3.0 |
| Helper plugin | 2.1.0 |
| WordPress REST API | wp/v2, WordPress 5.6 or newer |
| Node | >= 22 |

---

## 2.0.1, 2026-10-05

- **Built on Slipway 0.1.17**, which a fresh install of 2.0.0 already used. Since the Slipway 2.0.0 was measured on, 0.1.11, `which` also reads a tool's argument names and prints a title once where a description opens with it, and the general help names the settings that connect an account and the safety switches and counts the rest, which `agent-context` describes one by one. [Slipway's changelog](https://github.com/thenavidm/slipway/blob/main/CHANGELOG.md) lists the rest.
- **A test checks that every setting is named in `--help` or described by `agent-context`**, where it asked `--help` to name each one.

## 2.0.0, 2026-10-05

Built on [Slipway](https://github.com/thenavidm/slipway) 0.1.11. The 42 tools keep their names and arguments, and every difference below was measured against 1.1.3, the last version on npm, before release.

- **A person approves each call that cannot be undone, over MCP.** Publishing or scheduling, permanent deletion, replacing an Elementor layout and bulk edits: 13 tools can be one, and Slipway decides each call from its arguments, so saving a draft or trashing a post still needs nothing. Claude Code (2.1.246 and later) shows its own prompt, and a client that can show forms asks with an approval form whose one box starts unticked. Approvals are signed, bound to the exact call and work once. Where a client can do neither, the model's `confirm: true` still counts, and `WORDPRESS_CONFIRM=model` makes it enough everywhere. The audit log records who approved each write.
- **`WORDPRESS_ALLOW_DESTRUCTIVE=0` still refuses publishing and permanent deletion** and keeps every ordinary write, as 1.1 did.
- **A smaller tool list.** 21,418 tokens in Claude Code with every tool loaded, down from 23,263: the per-tool `$schema` line, an `execution` field and `additionalProperties: false` are gone. The last one advertised strict input while unknown keys were dropped anyway; the schema now says what happens. The resources now say their type.
- **WordPress's status and its own error code pick the exit code.** 401 and 403 exit 4, a missing route or post 3, and a rate limit 7 whatever the status, as in 1.1. An argument WordPress rejects (400) exits 2 instead of 5. The helper plugin missing, Rank Math switched off or its redirections module off exit 10 instead of 5, since each is something to set up. Naming a site that is not configured, or none when several are, exits 2 instead of 5. An unknown command and a write hidden by `WORDPRESS_READ_ONLY=1` exit 2 instead of 1, and `doctor` with nothing configured 10 instead of 1. 1 now means an unexpected error. WordPress's code, the site and the endpoint come along in `details`.
- **Fixed: a missing post on a helper route read as a missing plugin.** The plugin answers its own `not_found` for a post or redirect that does not exist, and 1.1 took every 404 on its namespace for the plugin not being installed. Only a missing route means that now; a missing post exits 3.
- **Fixed: a write's summary said "publish" for a draft.** The line a write shows in its approval, its refusal, `--dry-run` and the audit log was written for the irreversible case only, so 1.1's audit log recorded every draft as a publish and every trash as a permanent deletion. It now names the draft, the update or the trash when that is what the call does.
- **`which <words>` finds a command**, and `agent-context` describes every command, flag and setting as JSON. In Codex 0.159.3, finding the command that sets a post's Rank Math SEO title and meta description took 83,568 input tokens over the CLI instead of 84,368 (median of five), because Codex asked `which` instead of reading the full command list.
- **`install <client>`** adds the server to Claude Code, Codex, Claude Desktop, Cursor, VS Code or Gemini CLI in each one's own format.
- **The helper plugin's twelve are a toolset.** The command list groups them under their own heading, where 1.1 marked each with `+`, and `WORDPRESS_TOOLSETS=core` leaves them off both surfaces on a site without the plugin.
- **Less work to start.** The entry turns on Node's compile cache, and the server spends 162 ms of CPU before its first answer where 1.1.3 spent 188 (median of 21 runs, taking turns on one busy Mac). npx installs 4 dependencies instead of 94.
- **The release carries the desktop extension**, which the README now offers as the quickest Claude Desktop install, and the Docker image runs on Node 22.
- **Docs fixes.** The README has a Features table, the icon loads from cdn.navid.me, the exit codes include 1, the server instructions and docs use American spelling, and THIRD_PARTY_NOTICES.md lists the production dependencies' licenses.

### Upgrading

Node 22 or newer; 1.1 ran on 20. Scripts keep working for success, a refused write, missing credentials, a rate limit and a missing post; one that read exit 1 as an unknown command or a hidden write should read 2, and one that read exit 5 as a missing helper plugin should read 10, or as a rejected argument 2. Over MCP, expect an approval prompt or form before anything publishes or is deleted for good; a headless agent that should do either with `confirm: true` alone needs `WORDPRESS_CONFIRM=model`. The audit log's lines gain `surface`, `risk` and `confirmed_by`, and each allowed write is followed by a `done` or `failed` line. A script that pipes JSON-RPC into the server must keep stdin open until it reads the answer: the server now stops when its input ends, as the MCP stdio binding asks. `--http` refuses a page from another site unless `WORDPRESS_HTTP_ALLOWED_ORIGINS` lists it. Some terminal screens grew: the general help by 55 tokens, for `which`, `install`, the flags and the exit codes it now lists; the command list by 36, for the toolset headings and the lines that point to `which` and `--help`; and the refusal to publish without `--confirm` by 8, for its code and a hint that `--confirm` is only for an action the user asked for.

## 1.1.3, 2026-10-04

- **`npx -y @thenavidm/wordpress-mcp-cli` always starts the MCP server.** npx starts whichever binary the npm registry lists first when they share one file, and the registry does not keep the published order, so an MCP client set up with this README's install line could get `wordpress-cli` and its command list instead of a server. A third binary named after the package now always starts the server, and npx picks it by name.

## 1.1.2

A list of numbers works on the command line. `wordpress-cli create-post
--categories 5` passed the ID as the text "5", and validation rejected it, so
categories, tags and the bulk tools' `--post-ids` only worked over MCP. Each
value is now read as a number. The MCP tools were never affected.

## 1.1.1

The README told you to start the HTTP transport with `--http --port 8790`. The
port only parses in the equals form, so the space form is read as a bare flag
and silently falls back to the default. On 8790 that looks like it worked; on
any other port the server is not where the docs said it would be.

---

## 1.1.0

The CLI, and the rename that goes with it.

**The repository and the package are now `wordpress-mcp-cli`.** The name said
server when the thing ships two surfaces. The binaries are unchanged:
`wordpress-mcp` is still what an MCP client launches and `wordpress-cli` is
still what you type. This is the first release on npm, so nothing points at the
old name.

**`wordpress-cli` is every tool as a shell command.** All 42 of them, generated
from the same `ALL_TOOLS` array the MCP server registers, through the same
handlers and the same `WriteGuard`. Nothing is described twice, so a tool added
tomorrow is a command tomorrow. The command is the tool name with dashes, and
the underscore spelling works too.

That matters for cost. An MCP server sends its whole tool list on every turn
whether or not WordPress comes up; the CLI costs nothing until you type it. The
measured numbers are in the README.

**Exit codes an agent can branch on.** 0 ok, 2 usage or a refused write, 3 not
found, 4 auth, 5 API, 7 rate limited, 10 nothing configured. Four of those were
wrong before this release:

- Nothing configured exited 4, because "no WordPress site is configured" names
  an application password and the auth branch matched it first. It now exits 10,
  which is the code that means *set something up*, not *your credential expired*.
- A write the guard refused exited 5, as though the site had failed. It exits 2:
  the caller has to add `--confirm` or lift `WORDPRESS_READ_ONLY`, and no retry
  will help.
- An array of enum values took JSON, so `--status draft` was rejected and you
  had to write `--status '"draft"'`.
- `wordpress-cli doctor` and `wordpress-cli help` were rejected as unknown
  commands, which sent anyone whose setup was broken to the server binary to
  diagnose the CLI. Both now reach the entry point.

**`--select` no longer drops fields.** Two paths under one head overwrote each
other, so `--select posts.id,posts.title` returned only the title and said
nothing about it. Paths are now grouped by their first segment before recursing.
That was silent data loss in the one flag whose entire purpose is choosing what
you keep, and on a WordPress listing `--select` is not optional: a page of posts
is mostly rendered HTML and `_links` nobody asked for.

**One version number, read from `package.json` at startup.** It was a literal in
`server.ts`, so `--version`, `doctor`, the MCP handshake and the desktop
extension could each report a number the running code was not.

**A Claude Desktop extension.** `desktop-extension/build.sh` produces a `.mcpb`
that vendors its own dependencies, so it installs on a double click and asks for
the site address, the username and the application password in a form rather
than a JSON file.

**The publish workflow fires on a tag** and refuses when the tag and
`package.json` disagree, rather than on a release created by hand. A tag and a
package version that disagree cannot be untangled once both are on the registry.

---

## 1.0.0

First release.

Rebuilt in TypeScript from an earlier single-file JavaScript version. The tool
surface is the same 42 tools, because that set was worked out against real
sites, but everything underneath it changed.

**Multi-site is now explicit.** Sites are named, every tool takes an optional
`site`, and a call that does not name one when several are configured is
refused rather than resolved to whichever happened to be first. Publishing to a
client's site instead of your own is not a mistake worth risking to save a word.

**Safety, which the previous version had none of.** Publishing, permanent
deletion, replacing an Elementor layout and any bulk operation now take
`confirm: true`. Trashing, drafting and ordinary edits deliberately do not:
confirming everything trains the reflex that makes a confirmation on a real
deletion worthless. `WORDPRESS_READ_ONLY=1` removes all 20 write tools from the
list rather than refusing them at call time, and `WORDPRESS_AUDIT_LOG` records
every attempted write.

**Errors say what to do.** WordPress answers a failure with a precise code, and
the previous version passed the raw response text through, so a model saw a wall
of HTML or a bare `rest_cannot_edit` and had nothing to try differently. Each
code that has a real fix now carries a sentence naming it, and a site behind a
security plugin is reported as such rather than as a JSON parse error.

**Pagination totals are surfaced.** `X-WP-Total` and `X-WP-TotalPages` are
folded into list results, so ten rows out of four hundred says so instead of
reading as the whole set.

**An HTTP transport**, which refuses to bind anything but loopback without
`WORDPRESS_HTTP_TOKEN`. Anything reaching that port can publish to and delete
from the site without ever seeing the credential.

**`doctor`**, which walks HTTPS, then the shape of the application password,
then authentication, then the user's role, then the helper plugin, and stops at
the first thing genuinely broken.

**Reads are retried, writes are never.** A retried POST on a flaky connection is
how a post gets published twice.

64 tests, against a faked transport rather than the network.

### Helper plugin 2.1.0

**Per-object capability checks.** The routes previously checked only
`edit_posts`, which asks whether a user may edit posts at all, not whether they
may edit *this* post. An Author could therefore read and write protected meta on
another user's content through the plugin, which both wp-admin and the core REST
API refuse. Every route now checks `edit_post` with the ID, and the bulk routes
check each post in turn and report the ones refused rather than half-applying.
Deleting checks `delete_post`, which WordPress treats as its own capability.

Relicensed GPL-2.0-or-later, as WordPress plugins are, and the header no longer
points at a retired URL.
