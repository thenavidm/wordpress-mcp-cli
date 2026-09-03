# Security

## Reporting a vulnerability

[Report it privately](https://github.com/thenavidm/wordpress-mcp-cli/security/advisories/new).
Please do not open a public issue for a security problem: an issue is visible to
everyone the moment you file it, including whoever would use the bug.

## What this server can reach

It holds a WordPress application password and acts as the user that password
belongs to. That user's role is the real boundary: the server cannot do anything
in WordPress that the user could not do while logged in.

With an Administrator account, that includes publishing, editing and permanently
deleting content across the whole site.

## Reducing what it can do

- **Give it its own user.** Create a WordPress account for the agent with the
  lowest role that covers the work, rather than reusing your own Administrator
  login. Editor is enough for everything except site settings.
- **`WORDPRESS_READ_ONLY=1`** removes every write tool from the list, so a model
  cannot call one.
- **`WORDPRESS_ALLOW_DESTRUCTIVE=0`** keeps ordinary writes but blocks
  publishing and permanent deletion.
- **`WORDPRESS_AUDIT_LOG=<path>`** appends one JSON line for every attempted
  write, allowed and blocked alike.
- **Revoke rather than rotate.** Application passwords are individually
  revocable in **Users → Profile**, under **Application Passwords**, without
  touching your login password or any other integration.

## Running it over HTTP

The HTTP transport binds `127.0.0.1` by default, and refuses to bind any other
address without `WORDPRESS_HTTP_TOKEN` set. Anything that can reach the port can
publish to and delete from the site without ever seeing the credential, so an
open port is equivalent to handing out the application password.

## What is never logged

Credentials are not written to the audit log, to stderr, or into any error
message. Errors name the site by its short label rather than by any part of the
password.
