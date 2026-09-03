#!/usr/bin/env bash
# Add wordpress-mcp to Claude Code, prompting for what it needs.
#
# Nothing here is required: the README's `claude mcp add` line does the same
# thing in one command. This exists for the case where someone would rather be
# asked than compose the flags, and it validates the two values that are
# usually wrong before writing anything.
set -euo pipefail

command -v claude >/dev/null 2>&1 || {
  echo "Claude Code is not installed. See https://claude.com/claude-code" >&2
  exit 1
}

read -r -p "Site URL (https://example.com): " SITE_URL
read -r -p "WordPress username: " USERNAME
read -r -s -p "Application password: " APP_PASSWORD
echo

SITE_URL="${SITE_URL%/}"

case "$SITE_URL" in
  https://*) ;;
  *)
    echo "The site has to be served over HTTPS. WordPress disables application passwords over plain HTTP." >&2
    exit 1
    ;;
esac

STRIPPED="${APP_PASSWORD// /}"
if [ "${#STRIPPED}" -ne 24 ]; then
  echo "That is ${#STRIPPED} characters ignoring spaces, where WordPress generates 24." >&2
  echo "This is probably a login password. Create an application password under Users, then Profile." >&2
  exit 1
fi

claude mcp add wordpress \
  -e "WORDPRESS_SITE_URL=$SITE_URL" \
  -e "WORDPRESS_USERNAME=$USERNAME" \
  -e "WORDPRESS_APP_PASSWORD=$APP_PASSWORD" \
  -- npx -y @thenavidm/wordpress-mcp-cli@latest

echo
echo "Added. Checking the connection:"
WORDPRESS_SITE_URL="$SITE_URL" \
WORDPRESS_USERNAME="$USERNAME" \
WORDPRESS_APP_PASSWORD="$APP_PASSWORD" \
  npx -y @thenavidm/wordpress-mcp-cli@latest doctor
