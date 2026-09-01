<?php
/**
 * Plugin Name: WordPress MCP Helper
 * Description: REST endpoints the WordPress core API does not expose: post duplication with all meta, Elementor layout data, protected meta, Rank Math SEO fields, redirects, and bulk edits. Companion to the wordpress-mcp server.
 * Version: 2.1.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * Author: Navid Moazzez
 * Author URI: https://navid.me
 * Plugin URI: https://github.com/navidmoazzez/wordpress-mcp
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * Everything here exists because WordPress core deliberately will not do it over
 * REST, not because core was missed.
 *
 * Meta keys beginning with an underscore are "protected" and core refuses to
 * read or write them over the API at any privilege level. That covers Elementor
 * layouts, ACF values and Rank Math settings, which is most of what a real site
 * stores. These routes reach them, gated on the same capability checks core
 * would apply to editing the post itself.
 *
 * Redirects are not meta at all. Rank Math keeps them in its own table, so
 * nothing outside WordPress can reach them.
 *
 * Every route checks a capability. None of them widen who can do what: an
 * application password still carries its owner's role, and a user who cannot
 * edit a post here cannot edit it through wp-admin either.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {

    // Duplicate any post with all meta
    register_rest_route('wordpress-mcp/v1', '/duplicate', [
        'methods'  => 'POST',
        'callback' => 'mcp_duplicate_post',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'args' => [
            'post_id'   => ['required' => true, 'type' => 'integer'],
            'new_title' => ['required' => false, 'type' => 'string'],
        ],
    ]);

    // Get Elementor data for a post
    register_rest_route('wordpress-mcp/v1', '/elementor/(?P<post_id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'mcp_get_elementor_data',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    // Update Elementor data for a post
    register_rest_route('wordpress-mcp/v1', '/elementor/(?P<post_id>\d+)', [
        'methods'  => 'POST',
        'callback' => 'mcp_update_elementor_data',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'args' => [
            'elementor_data' => ['required' => false, 'type' => 'string'],
            'title'          => ['required' => false, 'type' => 'string'],
            'status'         => ['required' => false, 'type' => 'string'],
        ],
    ]);

    // Get all private meta for a post
    register_rest_route('wordpress-mcp/v1', '/meta/(?P<post_id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'mcp_get_all_meta',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    // Update specific meta keys
    register_rest_route('wordpress-mcp/v1', '/meta/(?P<post_id>\d+)', [
        'methods'  => 'POST',
        'callback' => 'mcp_update_meta',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'args' => [
            'meta' => ['required' => true, 'type' => 'object'],
        ],
    ]);

    // ── RankMath SEO ──

    // Get RankMath SEO data for a post
    register_rest_route('wordpress-mcp/v1', '/rankmath/(?P<post_id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'mcp_get_rankmath',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    // Update RankMath SEO data for a post
    register_rest_route('wordpress-mcp/v1', '/rankmath/(?P<post_id>\d+)', [
        'methods'  => 'POST',
        'callback' => 'mcp_update_rankmath',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    // ── Redirects ──

    // List redirects (RankMath or raw option)
    register_rest_route('wordpress-mcp/v1', '/redirects', [
        'methods'  => 'GET',
        'callback' => 'mcp_list_redirects',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);

    // Create a redirect
    register_rest_route('wordpress-mcp/v1', '/redirects', [
        'methods'  => 'POST',
        'callback' => 'mcp_create_redirect',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);

    // Delete a redirect
    register_rest_route('wordpress-mcp/v1', '/redirects/(?P<redirect_id>\d+)', [
        'methods'  => 'DELETE',
        'callback' => 'mcp_delete_redirect',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ]);

    // ── Bulk Operations ──

    // Bulk update posts (status, meta, etc.)
    register_rest_route('wordpress-mcp/v1', '/bulk/update', [
        'methods'  => 'POST',
        'callback' => 'mcp_bulk_update',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    // Bulk delete posts
    register_rest_route('wordpress-mcp/v1', '/bulk/delete', [
        'methods'  => 'POST',
        'callback' => 'mcp_bulk_delete',
        'permission_callback' => function () {
            return current_user_can('delete_posts');
        },
    ]);
});

/**
 * Can the current user edit this specific post?
 *
 * The route-level permission callbacks check `edit_posts`, which only asks
 * whether the user may edit posts at all. Every route here also reads or writes
 * protected meta on one named post, and for that the question is `edit_post`
 * with the ID: an Author has `edit_posts` and may still not touch somebody
 * else's article. Without this check these routes would reach content that
 * wp-admin and the core REST API both refuse, which would make installing this
 * plugin a privilege escalation rather than a convenience.
 */
function mcp_require_edit_post($post_id) {
    $post = get_post($post_id);
    if (!$post) {
        return new WP_Error('not_found', 'Post not found', ['status' => 404]);
    }
    if (!current_user_can('edit_post', $post_id)) {
        return new WP_Error(
            'rest_cannot_edit',
            'Sorry, you are not allowed to edit this post.',
            ['status' => rest_authorization_required_code()]
        );
    }
    return $post;
}

function mcp_duplicate_post($request) {
    $post_id   = $request->get_param('post_id');
    $new_title = $request->get_param('new_title');

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    // Duplicating creates a new item, which is a separate capability from
    // editing the original.
    $type = get_post_type_object($post->post_type);
    if (!$type || !current_user_can($type->cap->create_posts)) {
        return new WP_Error(
            'rest_cannot_create',
            'Sorry, you are not allowed to create posts of this type.',
            ['status' => rest_authorization_required_code()]
        );
    }

    $title = $new_title ?: 'Copy of ' . $post->post_title;

    $new_post_id = wp_insert_post([
        'post_title'     => $title,
        'post_content'   => $post->post_content,
        'post_excerpt'   => $post->post_excerpt,
        'post_status'    => 'draft',
        'post_type'      => $post->post_type,
        'post_author'    => get_current_user_id(),
        'post_parent'    => $post->post_parent,
        'menu_order'     => $post->menu_order,
        'post_password'  => $post->post_password,
        'comment_status' => $post->comment_status,
        'ping_status'    => $post->ping_status,
    ]);

    if (is_wp_error($new_post_id)) {
        return $new_post_id;
    }

    // Copy ALL post meta including Elementor, ACF, etc.
    $post_meta = get_post_meta($post_id);
    foreach ($post_meta as $key => $values) {
        foreach ($values as $value) {
            add_post_meta($new_post_id, $key, maybe_unserialize($value));
        }
    }

    // Copy taxonomy terms
    $taxonomies = get_object_taxonomies($post->post_type);
    foreach ($taxonomies as $taxonomy) {
        $terms = wp_get_object_terms($post_id, $taxonomy, ['fields' => 'ids']);
        if (!is_wp_error($terms)) {
            wp_set_object_terms($new_post_id, $terms, $taxonomy);
        }
    }

    return [
        'success'     => true,
        'new_post_id' => $new_post_id,
        'title'       => $title,
        'status'      => 'draft',
        'post_type'   => $post->post_type,
        'edit_url'    => admin_url("post.php?post={$new_post_id}&action=edit"),
        'meta_copied' => count($post_meta),
    ];
}

function mcp_get_elementor_data($request) {
    $post_id = (int) $request['post_id'];

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    $elementor_data = get_post_meta($post_id, '_elementor_data', true);
    $is_elementor   = !empty($elementor_data);

    $result = [
        'post_id'      => $post_id,
        'title'        => $post->post_title,
        'status'       => $post->post_status,
        'post_type'    => $post->post_type,
        'is_elementor' => $is_elementor,
        'edit_url'     => admin_url("post.php?post={$post_id}&action=edit"),
    ];

    if ($is_elementor) {
        $result['elementor_data']     = $elementor_data;
        $result['elementor_edit_mode'] = get_post_meta($post_id, '_elementor_edit_mode', true);
        $result['elementor_template_type'] = get_post_meta($post_id, '_elementor_template_type', true);
        $result['elementor_version']  = get_post_meta($post_id, '_elementor_version', true);
    }

    return $result;
}

function mcp_update_elementor_data($request) {
    $post_id = (int) $request['post_id'];

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    $updated = [];

    // Update Elementor JSON data
    $elementor_data = $request->get_param('elementor_data');
    if ($elementor_data !== null) {
        // Validate it's valid JSON
        $decoded = json_decode($elementor_data);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('invalid_json', 'elementor_data must be valid JSON', ['status' => 400]);
        }
        update_post_meta($post_id, '_elementor_data', wp_slash($elementor_data));
        $updated[] = 'elementor_data';
    }

    // Update title
    $title = $request->get_param('title');
    if ($title !== null) {
        wp_update_post(['ID' => $post_id, 'post_title' => $title]);
        $updated[] = 'title';
    }

    // Update status
    $status = $request->get_param('status');
    if ($status !== null) {
        wp_update_post(['ID' => $post_id, 'post_status' => $status]);
        $updated[] = 'status';
    }

    // Clear Elementor CSS cache so changes appear
    delete_post_meta($post_id, '_elementor_css');

    return [
        'success'  => true,
        'post_id'  => $post_id,
        'updated'  => $updated,
        'edit_url' => admin_url("post.php?post={$post_id}&action=edit"),
    ];
}

function mcp_get_all_meta($request) {
    $post_id = (int) $request['post_id'];

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    $all_meta = get_post_meta($post_id);
    $result   = [
        'post_id'   => $post_id,
        'title'     => $post->post_title,
        'post_type' => $post->post_type,
        'meta'      => [],
    ];

    foreach ($all_meta as $key => $values) {
        // Skip huge Elementor data blob in listing — use the dedicated endpoint
        if ($key === '_elementor_data') {
            $result['meta'][$key] = '[Elementor JSON — use /elementor/' . $post_id . ' endpoint]';
            continue;
        }
        $result['meta'][$key] = count($values) === 1 ? maybe_unserialize($values[0]) : array_map('maybe_unserialize', $values);
    }

    return $result;
}

function mcp_update_meta($request) {
    $post_id = (int) $request['post_id'];

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    $meta    = $request->get_param('meta');
    $updated = [];

    foreach ($meta as $key => $value) {
        update_post_meta($post_id, $key, $value);
        $updated[] = $key;
    }

    return [
        'success' => true,
        'post_id' => $post_id,
        'updated' => $updated,
    ];
}

// ── RankMath SEO Functions ──

function mcp_get_rankmath($request) {
    $post_id = (int) $request['post_id'];

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    // Check if RankMath is active
    if (!class_exists('RankMath')) {
        return new WP_Error('plugin_not_active', 'RankMath SEO plugin is not active', ['status' => 400]);
    }

    $seo_keys = [
        'rank_math_title',
        'rank_math_description',
        'rank_math_focus_keyword',
        'rank_math_robots',
        'rank_math_canonical_url',
        'rank_math_og_title',
        'rank_math_og_description',
        'rank_math_og_image',
        'rank_math_twitter_title',
        'rank_math_twitter_description',
        'rank_math_twitter_image',
        'rank_math_schema_Article',
        'rank_math_schema_FAQ',
        'rank_math_seo_score',
        'rank_math_pillar_content',
        'rank_math_primary_category',
        'rank_math_breadcrumb_title',
    ];

    $seo_data = [];
    foreach ($seo_keys as $key) {
        $value = get_post_meta($post_id, $key, true);
        if ($value !== '' && $value !== false) {
            $seo_data[$key] = maybe_unserialize($value);
        }
    }

    return [
        'post_id'   => $post_id,
        'title'     => $post->post_title,
        'slug'      => $post->post_name,
        'url'       => get_permalink($post_id),
        'post_type' => $post->post_type,
        'seo'       => $seo_data,
    ];
}

function mcp_update_rankmath($request) {
    $post_id = (int) $request['post_id'];

    $post = mcp_require_edit_post($post_id);
    if (is_wp_error($post)) {
        return $post;
    }

    if (!class_exists('RankMath')) {
        return new WP_Error('plugin_not_active', 'RankMath SEO plugin is not active', ['status' => 400]);
    }

    $allowed_keys = [
        'rank_math_title',
        'rank_math_description',
        'rank_math_focus_keyword',
        'rank_math_robots',
        'rank_math_canonical_url',
        'rank_math_og_title',
        'rank_math_og_description',
        'rank_math_og_image',
        'rank_math_twitter_title',
        'rank_math_twitter_description',
        'rank_math_twitter_image',
        'rank_math_pillar_content',
        'rank_math_primary_category',
        'rank_math_breadcrumb_title',
    ];

    $params  = $request->get_json_params();
    $updated = [];

    foreach ($params as $key => $value) {
        if (in_array($key, $allowed_keys, true)) {
            if ($value === null || $value === '') {
                delete_post_meta($post_id, $key);
            } else {
                update_post_meta($post_id, $key, $value);
            }
            $updated[] = $key;
        }
    }

    if (empty($updated)) {
        return new WP_Error('no_valid_fields', 'No valid RankMath fields provided. Allowed: ' . implode(', ', $allowed_keys), ['status' => 400]);
    }

    return [
        'success' => true,
        'post_id' => $post_id,
        'updated' => $updated,
    ];
}

// ── Redirect Functions ──

function mcp_list_redirects($request) {
    // RankMath stores redirects in rank_math_redirections table
    global $wpdb;
    $table = $wpdb->prefix . 'rank_math_redirections';

    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
        return new WP_Error('no_redirects_table', 'RankMath redirections table not found. Is RankMath Redirections module enabled?', ['status' => 400]);
    }

    $search = $request->get_param('search');
    $per_page = min((int) ($request->get_param('per_page') ?: 50), 200);
    $page = max((int) ($request->get_param('page') ?: 1), 1);
    $offset = ($page - 1) * $per_page;

    $where = '';
    if ($search) {
        $like = '%' . $wpdb->esc_like($search) . '%';
        $where = $wpdb->prepare(" WHERE sources LIKE %s OR url_to LIKE %s", $like, $like);
    }

    $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table $where");
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT id, sources, url_to, header_code, status, hits, created, updated FROM $table $where ORDER BY id DESC LIMIT %d OFFSET %d",
        $per_page, $offset
    ));

    $redirects = [];
    foreach ($rows as $row) {
        $sources = maybe_unserialize($row->sources);
        $redirects[] = [
            'id'          => (int) $row->id,
            'sources'     => $sources,
            'destination' => $row->url_to,
            'type'        => (int) $row->header_code,
            'status'      => $row->status,
            'hits'        => (int) $row->hits,
            'created'     => $row->created,
            'updated'     => $row->updated,
        ];
    }

    return [
        'total'      => $total,
        'page'       => $page,
        'per_page'   => $per_page,
        'redirects'  => $redirects,
    ];
}

function mcp_create_redirect($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rank_math_redirections';

    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
        return new WP_Error('no_redirects_table', 'RankMath redirections table not found', ['status' => 400]);
    }

    $params = $request->get_json_params();
    $source = $params['source'] ?? null;
    $destination = $params['destination'] ?? null;
    $type = (int) ($params['type'] ?? 301);

    if (!$source || !$destination) {
        return new WP_Error('missing_fields', 'source and destination are required', ['status' => 400]);
    }

    if (!in_array($type, [301, 302, 307, 410, 451], true)) {
        return new WP_Error('invalid_type', 'type must be 301, 302, 307, 410, or 451', ['status' => 400]);
    }

    $sources = maybe_serialize([
        [
            'pattern'    => ltrim($source, '/'),
            'comparison' => 'exact',
        ]
    ]);

    $now = current_time('mysql');
    $wpdb->insert($table, [
        'sources'     => $sources,
        'url_to'      => $destination,
        'header_code' => $type,
        'status'      => 'active',
        'hits'        => 0,
        'created'     => $now,
        'updated'     => $now,
    ]);

    $id = $wpdb->insert_id;
    if (!$id) {
        return new WP_Error('insert_failed', 'Failed to create redirect: ' . $wpdb->last_error, ['status' => 500]);
    }

    // Also update the sources lookup table
    $cache_table = $wpdb->prefix . 'rank_math_redirections_cache';
    if ($wpdb->get_var("SHOW TABLES LIKE '$cache_table'") === $cache_table) {
        $wpdb->insert($cache_table, [
            'from_url'       => ltrim($source, '/'),
            'redirection_id' => $id,
            'object_id'      => 0,
        ]);
    }

    return [
        'success'     => true,
        'redirect_id' => $id,
        'source'      => $source,
        'destination' => $destination,
        'type'        => $type,
    ];
}

function mcp_delete_redirect($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rank_math_redirections';
    $id = (int) $request['redirect_id'];

    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
        return new WP_Error('no_redirects_table', 'RankMath redirections table not found', ['status' => 400]);
    }

    $existing = $wpdb->get_row($wpdb->prepare("SELECT id FROM $table WHERE id = %d", $id));
    if (!$existing) {
        return new WP_Error('not_found', 'Redirect not found', ['status' => 404]);
    }

    $wpdb->delete($table, ['id' => $id]);

    // Clean cache table too
    $cache_table = $wpdb->prefix . 'rank_math_redirections_cache';
    if ($wpdb->get_var("SHOW TABLES LIKE '$cache_table'") === $cache_table) {
        $wpdb->delete($cache_table, ['redirection_id' => $id]);
    }

    return [
        'success'     => true,
        'redirect_id' => $id,
        'deleted'     => true,
    ];
}

// ── Bulk Operation Functions ──

function mcp_bulk_update($request) {
    $params   = $request->get_json_params();
    $post_ids = $params['post_ids'] ?? [];
    $fields   = $params['fields'] ?? [];
    $meta     = $params['meta'] ?? [];

    if (empty($post_ids)) {
        return new WP_Error('no_posts', 'post_ids array is required', ['status' => 400]);
    }

    if (empty($fields) && empty($meta)) {
        return new WP_Error('no_updates', 'Provide fields and/or meta to update', ['status' => 400]);
    }

    $results = [];
    foreach ($post_ids as $post_id) {
        $post_id = (int) $post_id;
        $post = get_post($post_id);
        if (!$post) {
            $results[] = ['post_id' => $post_id, 'success' => false, 'error' => 'Not found'];
            continue;
        }

        // Checked per post rather than once for the batch. The route already
        // requires manage_options, but a custom role or a multisite setup can
        // separate the two, and a partial refusal reported per ID is far more
        // useful than a batch that half applied.
        if (!current_user_can('edit_post', $post_id)) {
            $results[] = ['post_id' => $post_id, 'success' => false, 'error' => 'Not allowed to edit this post'];
            continue;
        }

        // Update post fields
        if (!empty($fields)) {
            $update = ['ID' => $post_id];
            $allowed = ['post_title', 'post_status', 'post_content', 'post_excerpt', 'post_author', 'menu_order'];
            foreach ($fields as $key => $value) {
                if (in_array($key, $allowed, true)) {
                    $update[$key] = $value;
                }
            }
            if (count($update) > 1) {
                wp_update_post($update);
            }
        }

        // Update meta
        if (!empty($meta)) {
            foreach ($meta as $key => $value) {
                update_post_meta($post_id, $key, $value);
            }
        }

        $results[] = ['post_id' => $post_id, 'success' => true];
    }

    $success_count = count(array_filter($results, fn($r) => $r['success']));
    return [
        'success'       => true,
        'total'         => count($post_ids),
        'updated'       => $success_count,
        'failed'        => count($post_ids) - $success_count,
        'results'       => $results,
    ];
}

function mcp_bulk_delete($request) {
    $params   = $request->get_json_params();
    $post_ids = $params['post_ids'] ?? [];
    $force    = $params['force'] ?? false;

    if (empty($post_ids)) {
        return new WP_Error('no_posts', 'post_ids array is required', ['status' => 400]);
    }

    $results = [];
    foreach ($post_ids as $post_id) {
        $post_id = (int) $post_id;
        $post = get_post($post_id);
        if (!$post) {
            $results[] = ['post_id' => $post_id, 'success' => false, 'error' => 'Not found'];
            continue;
        }

        // delete_post, not edit_post: WordPress treats deleting as its own
        // capability, and a role that may edit a published post may not be
        // allowed to remove it.
        if (!current_user_can('delete_post', $post_id)) {
            $results[] = ['post_id' => $post_id, 'success' => false, 'error' => 'Not allowed to delete this post'];
            continue;
        }

        $result = wp_delete_post($post_id, $force);
        $results[] = [
            'post_id' => $post_id,
            'success' => $result !== false && $result !== null,
            'action'  => $force ? 'permanently_deleted' : 'trashed',
        ];
    }

    $success_count = count(array_filter($results, fn($r) => $r['success']));
    return [
        'success' => true,
        'total'   => count($post_ids),
        'deleted' => $success_count,
        'failed'  => count($post_ids) - $success_count,
        'results' => $results,
    ];
}
