# Versions

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
