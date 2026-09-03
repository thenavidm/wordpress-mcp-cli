# WordPress MCP Server & CLI changelog

| Component | Version | Last Updated |
|-----------|---------|--------------|
| wordpress-mcp-cli | 1.1.1 | 2026-09-04 |
| Helper plugin | 2.1.0 | 2026-09-02 |

---

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
