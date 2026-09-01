/**
 * Turning a WordPress failure into something the caller can act on.
 *
 * WordPress answers a failed REST call with a JSON body carrying a `code` and a
 * `message`, and those codes are precise: `rest_cannot_edit` is a capability
 * problem, `rest_post_invalid_id` is a bad argument, `rest_no_route` means the
 * endpoint is not registered on that install. The original version of this
 * server surfaced the raw response text, which meant a model saw a wall of HTML
 * or a bare code and had nothing to do differently on the retry.
 *
 * So every code that has a real fix gets a sentence naming the fix. The rest
 * fall through with the code and the site attached, because knowing which of
 * three sites refused is most of the diagnosis.
 */

export class WordPressError extends Error {
  readonly status: number;
  readonly code: string;
  readonly site: string;
  readonly endpoint: string;
  readonly detail?: string;

  constructor(init: {
    message: string;
    status: number;
    code: string;
    site: string;
    endpoint: string;
    detail?: string;
  }) {
    super(init.message);
    this.name = "WordPressError";
    this.status = init.status;
    this.code = init.code;
    this.site = init.site;
    this.endpoint = init.endpoint;
    this.detail = init.detail;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      status: this.status,
      site: this.site,
      endpoint: this.endpoint,
      ...(this.detail ? { detail: this.detail } : {}),
    };
  }
}

/** Blocked by read-only mode or a missing confirm, before anything left the machine. */
export class WriteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteBlockedError";
  }

  toJSON(): Record<string, unknown> {
    return { error: this.message, code: "write_blocked" };
  }
}

/**
 * The helper plugin is not installed on this site.
 *
 * Worth its own type because it is the single most common failure on a fresh
 * setup and the fix is a file copy, not a permission change. Twelve of the tools
 * need it and the other thirty do not, so this has to say which is which
 * rather than reading as though the whole server is broken.
 */
export class HelperPluginMissingError extends Error {
  readonly site: string;

  constructor(site: string, tool: string) {
    super(
      `${tool} needs the WordPress MCP Helper plugin, which is not installed on "${site}". ` +
        "Copy plugin/mcp-wordpress-helper.php into wp-content/mu-plugins/ on that site and it takes effect immediately, with nothing to activate. " +
        "Everything that only uses the core REST API keeps working without it.",
    );
    this.name = "HelperPluginMissingError";
    this.site = site;
  }

  toJSON(): Record<string, unknown> {
    return { error: this.message, code: "helper_plugin_missing", site: this.site };
  }
}

/** WordPress error codes worth translating, and what to actually do about them. */
const GUIDANCE: Record<string, string> = {
  rest_no_route:
    "That endpoint is not registered on this site. Either the REST API is disabled or restricted by a security plugin, or the post type is registered without show_in_rest.",
  rest_cannot_edit:
    "This user cannot edit that item. Application passwords carry the user's own role, so an Author can only reach their own posts. Use an Editor or Administrator account to manage other people's content.",
  rest_cannot_create:
    "This user cannot create that. Check the account's role, and that the post type is registered with show_in_rest and a REST base.",
  rest_cannot_delete: "This user cannot delete that item. An Editor or Administrator role is needed.",
  rest_cannot_view:
    "This user cannot read that. Drafts, private posts and other people's content need a role that can see them.",
  rest_forbidden:
    "The site refused this request. Application passwords are disabled over plain HTTP, so the site has to be reachable over HTTPS, and some security plugins block the REST API for logged-in routes.",
  rest_post_invalid_id: "No post exists with that ID on this site.",
  rest_invalid_param: "One of the arguments was rejected by WordPress. The detail below names the field.",
  rest_invalid_field: "That field does not exist on this post type.",
  rest_cannot_assign_term:
    "This user cannot assign that category or tag. Assigning terms needs a role that can manage them.",
  rest_upload_no_content_disposition: "The upload was rejected because the filename was missing.",
  rest_upload_unknown_error: "WordPress rejected the upload. The most common cause is a file type the site does not allow.",
  rest_upload_sideload_error:
    "WordPress could not write the file. Check that wp-content/uploads is writable and that the file type is permitted.",
  incorrect_password:
    "The application password was rejected. It is not the login password: generate one at Users > Profile > Application Passwords, and paste it exactly as shown, spaces included.",
  invalid_username: "No user with that username exists on this site.",
};

/**
 * Read a failed response into a typed error.
 *
 * The body is read as text first and parsed after, because a site behind a
 * security plugin or a WAF answers with HTML rather than JSON and calling
 * `.json()` on that throws a parse error that hides the real status.
 */
export async function errorFromResponse(
  response: Response,
  site: string,
  endpoint: string,
): Promise<WordPressError> {
  const text = await response.text().catch(() => "");
  let code = `http_${response.status}`;
  let message = "";
  let detail: string | undefined;

  try {
    const body = JSON.parse(text) as {
      code?: string;
      message?: string;
      data?: { params?: Record<string, string> };
    };
    if (body.code) code = body.code;
    if (body.message) message = stripTags(body.message);
    const params = body.data?.params;
    if (params) detail = Object.values(params).join(" ");
  } catch {
    // Not JSON. An HTML body means something in front of WordPress answered,
    // which is a different problem from WordPress refusing, so say so.
    if (/^\s*</.test(text)) {
      detail =
        "The site returned HTML rather than a REST response, so something in front of WordPress answered: a security plugin, a firewall, a maintenance page, or a redirect to a login screen.";
    } else if (text) {
      detail = text.slice(0, 400);
    }
  }

  if (!message) {
    message =
      response.status === 401
        ? "WordPress rejected the credentials."
        : response.status === 403
          ? "WordPress refused the request."
          : response.status === 404
            ? "WordPress found nothing at that endpoint."
            : `WordPress returned ${response.status}.`;
  }

  const guidance = GUIDANCE[code];
  const full = guidance ? `${message} ${guidance}` : message;

  return new WordPressError({
    message: `${full} (site: ${site})`,
    status: response.status,
    code,
    site,
    endpoint,
    detail,
  });
}

/** WordPress messages carry markup like <code>. A model reads the words, not the tags. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A network failure, before the site ever answered. */
export function networkError(error: unknown, site: string, url: string): WordPressError {
  const raw = (error as Error)?.message ?? String(error);
  const isAbort = (error as Error)?.name === "AbortError" || /abort/i.test(raw);
  const message = isAbort
    ? `The request to ${site} timed out. Raise WORDPRESS_REQUEST_TIMEOUT_MS if the site is simply slow.`
    : `Could not reach ${site} at ${url}. ${raw}. Check the site URL is right, that it is reachable over HTTPS, and that the REST API is not blocked.`;

  return new WordPressError({
    message,
    status: 0,
    code: isAbort ? "timeout" : "network_error",
    site,
    endpoint: url,
  });
}
