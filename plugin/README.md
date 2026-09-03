# WordPress MCP Helper

The companion plugin for [wordpress-mcp](https://github.com/thenavidm/wordpress-mcp).

Thirty of the server's 42 tools need nothing installed. This plugin enables the
other twelve.

## Why it has to exist

Everything here is something WordPress core deliberately will not do over REST,
rather than something core overlooked.

**Protected meta.** Any meta key beginning with an underscore is refused by the
core REST API at every privilege level, and any key not registered with
`show_in_rest` is ignored. Between them that covers Elementor layouts, ACF field
values and Rank Math settings, which is most of what a real site stores.

**Redirects are not meta at all.** Rank Math keeps them in its own database
table, reachable only from code running inside WordPress.

**Bulk edits.** Doing them one REST call at a time is slow and non-atomic.

## What it adds

| Route | Enables |
|---|---|
| `POST /duplicate` | `wp_duplicate_post` |
| `GET`/`POST /elementor/<id>` | `wp_get_elementor`, `wp_update_elementor` |
| `GET`/`POST /meta/<id>` | `wp_get_all_meta`, `wp_update_meta` |
| `GET`/`POST /rankmath/<id>` | `wp_get_rankmath`, `wp_update_rankmath` |
| `GET`/`POST`/`DELETE /redirects` | `wp_list_redirects`, `wp_create_redirect`, `wp_delete_redirect` |
| `POST /bulk/update`, `POST /bulk/delete` | `wp_bulk_update`, `wp_bulk_delete` |

All under the `wordpress-mcp/v1` namespace.

## Install

Copy `mcp-wordpress-helper.php` into `wp-content/mu-plugins/` on your site.
Files in that folder load automatically, so there is nothing to activate and
nothing that can be deactivated by accident.

It works as an ordinary plugin in `wp-content/plugins/` too, if you would rather
see it in the plugins list and be able to switch it off.

Requires WordPress 5.6 or newer and PHP 7.4 or newer. The Elementor and Rank
Math routes also need those plugins active, and report it clearly when they are
not.

## Permissions

It does not widen who can do what.

Every route checks a capability, and every route that acts on a post checks
`edit_post` **with that post's ID** rather than the generic `edit_posts`. So an
Author still reaches only their own content, exactly as in wp-admin. The bulk
routes check each post in turn and report the ones refused instead of
half-applying. Deleting checks `delete_post`, which WordPress treats as its own
capability. The redirect routes require `manage_options`.

An application password still carries its owner's role. This plugin gives an
agent no capability its user does not already have.

## Licence

[GPL-2.0-or-later](./LICENSE), as WordPress plugins are. The MCP server it
accompanies is MIT.
