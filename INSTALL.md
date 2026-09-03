# Install

The short version is in the [README](README.md#3-set-up-your-account-). This is
the long one, for when something does not work.

## What you are creating

An **application password**. WordPress has generated these since version 5.6.
They are not your login password, they cannot be used to sign in to wp-admin,
and each one is revocable on its own.

What they are not is a permission system. An application password authenticates
as the user who created it and inherits that user's role exactly. Choosing which
user creates it is the only access control you get.

## Before you start

Your site must be served over **HTTPS**. WordPress disables application
passwords over plain HTTP, and the failure it produces is a generic 401 that
says nothing about the cause.

## Creating one

1. Sign in to `wp-admin` on your site as the user the agent should act as.
2. Go to **Users**, then **Profile**.
   To create one for a different user, go to **Users**, then **All Users**, and
   edit that user instead.
3. Scroll to the **Application Passwords** section.
4. Enter a descriptive name. The name is only a label, so use something you will
   recognise later: `Claude MCP` rather than `test`.
5. Create the password.
6. Copy what WordPress shows you. It is displayed once, and there is no way to
   see it again. Losing it means revoking that one and making another, which
   costs nothing.

WordPress displays the password in space-separated groups of four. It is
accepted with the spaces or without them, so paste whichever you have.

### If the section is not there

Three things remove it:

- The site is on plain HTTP.
- A security plugin has disabled the feature, usually as part of an "API
  hardening" setting.
- Something calls the `wp_is_application_passwords_available` filter to switch
  it off, which some managed hosts do by default.

## Choosing the user

The role decides everything the agent can reach.

| Role | Reaches |
|---|---|
| Administrator | Everything, including site settings and permanent deletion |
| Editor | All content: publish, edit anyone's posts, upload media, manage terms |
| Author | Its own posts only, and its own uploads |
| Contributor | Its own drafts, and cannot publish |

Editor covers everything in this server except `wp_get_settings`.

**Give the agent its own WordPress user.** Not because the password is
dangerous, but because a separate user is separately revocable, shows up
separately in revision history, and lets you see what it changed.

An Author account authenticates perfectly and then refuses to edit anything that
is not its own, which reads as the server being broken when it is the role
working correctly. `wp_get_me` shows which role you are actually using.

## The helper plugin

Thirty of the 42 tools need nothing installed. Twelve need this.

Copy [`plugin/mcp-wordpress-helper.php`](../plugin/mcp-wordpress-helper.php)
into `wp-content/mu-plugins/` on your site, creating the folder if it is not
there. Files in `mu-plugins` load automatically: nothing to activate, and
nothing that can be switched off by accident.

If you would rather see it in the plugins list, put it in
`wp-content/plugins/` instead and activate it under **Plugins**.

Upload it however you normally move files: SFTP, your host's file manager, or
the file editor in your hosting control panel.

### Checking it took

    npx -y @thenavidm/wordpress-mcp doctor

The last line reports whether the plugin answered.

### What it does and does not do

It registers routes under `wordpress-mcp/v1` that reach protected meta,
Elementor layouts, Rank Math fields, Rank Math's redirects table, and bulk
operations. Every route checks the same capability WordPress itself would check
for that post, so it gives the agent nothing its user did not already have.

Elementor and Rank Math routes also need those plugins active, and say so
plainly when they are not.

## Several sites

Use `WORDPRESS_SITES` instead of the single-site variables:

```json
[
  {
    "name": "blog",
    "url": "https://example.com",
    "username": "you",
    "app_password": "xxxx xxxx xxxx xxxx xxxx xxxx"
  },
  {
    "name": "shop",
    "url": "https://shop.example.com",
    "username": "you",
    "app_password": "yyyy yyyy yyyy yyyy yyyy yyyy"
  }
]
```

Each site needs its own application password, created on that site, because
WordPress users do not span installs.

`name` is what you pass as `site` on a tool call, and what `wp_list_sites`
reports. Leave it out and it is derived from the hostname.

Set `WORDPRESS_DEFAULT_SITE` to whichever you work on most. Without it, a call
that does not name a site is refused rather than resolved to whichever happened
to be listed first.

## Revoking

**Users**, then **Profile**, then the **Application Passwords** section. Revoke
the one you want gone. It stops working immediately. Your login password and
every other application password are unaffected.

Revoke rather than change your login password: changing the login password does
not invalidate application passwords, which surprises people.

## Narrowing what the agent can do

| Variable | Effect |
|---|---|
| `WORDPRESS_READ_ONLY=1` | Removes all 20 write tools from the list entirely |
| `WORDPRESS_ALLOW_DESTRUCTIVE=0` | Keeps ordinary writes, blocks publishing and permanent deletion |
| `WORDPRESS_AUDIT_LOG=<path>` | One JSON line per attempted write, allowed and blocked |

Read-only removes the tools rather than refusing them when called. A model
cannot call a tool it cannot see, and cannot argue with a refusal it never
receives.
