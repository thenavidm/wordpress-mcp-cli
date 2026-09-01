# Working on this repo

For agents changing the code here. Users want [README.md](./README.md); models
driving the server want [SKILL.md](./SKILL.md).

## Shape

```
src/
  index.ts          entry, arg parsing, stdio or --http or doctor
  server.ts         assembles the server, instructions, resources, prompts
  config.ts         sites and settings, from env or injected
  safety.ts         risk levels, the write guard, annotations, fencing
  doctor.ts         the setup check
  api/
    client.ts       one WordPress install, both namespaces
    errors.ts       WordPress codes to actionable messages
  tools/
    kit.ts          defineTool, register, shared arguments
    *.ts            one module per group
  transport/http.ts streamable HTTP
plugin/             the PHP helper, GPL, copied into wp-content/mu-plugins/
```

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

**Errors are returned, not thrown.** A thrown MCP error reaches the model as a
protocol failure with no structure, discarding every message in `errors.ts`.

**The helper namespace 404 means the plugin is missing**, not that the request
was wrong. `client.ts` translates it; do not let a bare 404 through.

## Adding a tool

1. Add it to the module for what it reaches, not the endpoint it calls.
2. `defineTool`, with `surface: "core"` or `"helper"`.
3. Write the description for a model that cannot see the code: what it reaches,
   what it costs, and what will surprise the caller. Platform constraints belong
   here, not only in the README.
4. Add `...siteArg`, and `...confirmArg` if it can be destructive.
5. Export it from the group array. `tools/index.ts` picks it up.
6. Update the count in `README.md`, `SKILL.md`, `server.ts` instructions and
   `tests/tools.test.ts`, which asserts it.

## Verify

```bash
npm run verify      # typecheck, build, 64 tests
npx @modelcontextprotocol/inspector node dist/index.js
```

A green suite is not a working server. Run the handshake.

The PHP plugin is linted in CI, since PHP is not usually installed locally.

## House rules

Commits are authored `Navid Moazzez <n@navid.me>`. Never pass `-c user.email=`.
No AI attribution in commit messages. No em dashes in prose. Never name another
project as a comparison.
