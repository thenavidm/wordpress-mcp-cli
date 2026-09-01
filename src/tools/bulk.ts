/**
 * Editing many posts in one call.
 *
 * Both tools here are guarded, and not because a bulk edit is worse per post
 * than a single one. It is that the blast radius is a list the caller supplied,
 * and a wrong list is a wrong set of pages on a live site with no single undo.
 * Trashing forty posts one at a time gives forty chances to notice; doing it in
 * one call gives one.
 *
 * The IDs are taken as given. Neither tool checks that they are the post type
 * the caller had in mind, because the helper plugin operates on post IDs and a
 * post ID is a post ID, so listing first with `wp_list_posts` or
 * `wp_list_custom` and passing those IDs is the only real safeguard.
 */

import { z } from "zod";
import { publishes } from "../safety.js";
import { confirmArg, defineTool, siteArg } from "./kit.js";

export const bulkUpdate = defineTool({
  name: "wp_bulk_update",
  title: "Update many posts at once",
  description:
    "Apply the same changes to a list of posts in one call: change status, reassign the author, set a menu order, or write meta fields across all of them. Every post in the list gets the same values, so this is for uniform changes rather than per-post edits. Get the IDs from wp_list_posts or wp_list_custom rather than assembling them by hand. Needs confirm: true and the helper plugin.",
  schema: {
    post_ids: z
      .array(z.number().int())
      .min(1)
      .describe("IDs of the posts to update. Every one gets the same values."),
    fields: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        "Post table columns to set, using WordPress's own names: post_title, post_status, post_content, post_excerpt, post_author, menu_order. Setting post_status to publish makes every post in the list live at once.",
      ),
    meta: z
      .record(z.string(), z.any())
      .optional()
      .describe("Meta fields to write on every post in the list, including protected underscore-prefixed keys."),
    ...siteArg,
    ...confirmArg,
  },
  risk: "destructive",
  surface: "helper",
  summary: (args) => {
    const status = (args.fields as Record<string, unknown> | undefined)?.post_status;
    const what = publishes(typeof status === "string" ? status : undefined)
      ? "publish"
      : "update";
    return `${what} ${args.post_ids.length} posts in one call (IDs ${args.post_ids.slice(0, 8).join(", ")}${args.post_ids.length > 8 ? ", …" : ""})`;
  },
  handler: async (args, ctx) =>
    ctx.client(args.site).helperPost(
      "bulk/update",
      { post_ids: args.post_ids, fields: args.fields ?? {}, meta: args.meta ?? {} },
      "wp_bulk_update",
    ),
});

export const bulkDelete = defineTool({
  name: "wp_bulk_delete",
  title: "Trash or delete many posts at once",
  description:
    "Move a list of posts to the trash, or delete them permanently with force: true. Trashing is reversible from wp-admin, though restoring forty posts is forty clicks. Force is not reversible at all. Confirm the list is what was meant before calling either: this takes the IDs exactly as given. Needs confirm: true and the helper plugin.",
  schema: {
    post_ids: z.array(z.number().int()).min(1).describe("IDs of the posts to trash or delete."),
    force: z
      .boolean()
      .optional()
      .describe("Skip the trash and delete permanently. Not recoverable. Defaults to false, which trashes."),
    ...siteArg,
    ...confirmArg,
  },
  risk: "destructive",
  surface: "helper",
  summary: (args) =>
    `${args.force ? "permanently delete" : "trash"} ${args.post_ids.length} posts (IDs ${args.post_ids.slice(0, 8).join(", ")}${args.post_ids.length > 8 ? ", …" : ""})`,
  handler: async (args, ctx) =>
    ctx
      .client(args.site)
      .helperPost("bulk/delete", { post_ids: args.post_ids, force: args.force ?? false }, "wp_bulk_delete"),
});

export const BULK_TOOLS = [bulkUpdate, bulkDelete];
