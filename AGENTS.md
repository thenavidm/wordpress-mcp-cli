# Working on this repo

For agents changing the code here. Users want [README.md](./README.md); models
driving the server want [SKILL.md](./SKILL.md).

## Shape

```
src/
  index.ts          entry: turns on the compile cache and starts the app
  app.ts            the Slipway app: tools, settings, resources, prompts, doctor
  guide.ts          the server instructions, the concepts resource, the prompts
  config.ts         sites and settings, from env or injected
  content.ts        what counts as publishing, and fencing text from the site
  doctor.ts         the per-site checks
  api/
    client.ts       one WordPress install, both namespaces
    errors.ts       WordPress codes to actionable messages
  tools/
    kit.ts          defineTool for Slipway, shared arguments, error mapping
    *.ts            one module per group
plugin/             the PHP helper, GPL, copied into wp-content/mu-plugins/
```

[Slipway](https://github.com/thenavidm/slipway) owns MCP over stdio and
`--http`, the CLI, the write guard, approvals, annotations and the audit log.

## Rules that are not obvious

**Tools take a config, never `process.env`.** The same tool list serves the
local install and a host that holds one site's credentials per request. Reading
the environment inside a tool breaks the second case silently.

**`risk` can be a function of the arguments.** In WordPress the same call is
harmless or irreversible depending on what it is passed: `wp_update_post`
saving a draft against the same tool publishing. A fixed level would either
confirm every draft edit or confirm nothing that matters. The annotations
report the worst case, since a client reading them cannot see arguments.

**Guard publishing, not everything.** The rule is not "does it write" but "can
the user undo it from wp-admin in one action". Trash restores in one click, so
it is not guarded. Adding a confirm to a reversible action makes the confirm on
a real deletion worthless.

**Reads retry, writes never.** A retried POST publishes twice.

**Errors are typed, and mapped once.** A tool throws `WordPressError` or
`HelperPluginMissingError`; `toSlipway` in `tools/kit.ts` picks the exit code
from the status and WordPress's own code, and Slipway hands the model the
message, the code and the details as a tool result, never a protocol failure.

**A 404 on the helper namespace means the plugin is missing**, not that the
request was wrong, unless the plugin itself answered `not_found` for a post or
redirect. `client.ts` tells the two apart; do not let a bare 404 through.

## Adding a tool

1. Add it to the module for what it reaches, not the endpoint it calls.
2. `defineTool`, with `surface: "core"` or `"helper"`, which is also its toolset.
3. Write the description for a model that cannot see the code: what it reaches,
   what it costs, and what will surprise the caller. Platform constraints belong
   here, not only in the README.
4. Add `...siteArg`. Slipway adds `confirm` to anything that can be destructive.
5. Export it from the group array. `tools/index.ts` picks it up.
6. Update the count in `README.md`, `SKILL.md`, the instructions in `guide.ts`
   and `tests/tools.test.ts`, which asserts it.

## Verify

```bash
npm run verify      # typecheck, build, 89 tests
npx @modelcontextprotocol/inspector node dist/index.js
```

A green suite is not a working server. Run the handshake.

The PHP plugin is linted in CI, since PHP is not usually installed locally.

## House rules

Commits are authored `Navid Moazzez <n@navid.me>`. Never pass `-c user.email=`.
No AI attribution in commit messages. No em dashes in prose. Never name another
project as a comparison.
