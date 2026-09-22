/**
 * display.services.js
 *
 * Purpose:
 * - Contains database logic for retrieving posts
 * - Isolates raw SQL queries from controllers
 *
 * Responsibilities:
 * - Executes a cursor-paginated query for pending, top-level posts
 * - Returns one feed page and its next cursor to the controller
 *
 * Used by:
 * - display.controllers.js
 *
 * Function:
 * - displayPostsPageFromDB()
 *   - Fetches one stable, newest-first page from the database
 *
 * Notes:
 * - No HTTP logic or request/response handling should occur here
 * - Keeps controllers lightweight and focused on request handling
 * - Errors are allowed to bubble up to the controller for handling
 */

import pool from "../db.js";

export const displayPostsPageFromDB = async (userId, { limit, before, beforeId }) => {
  const queryLimit = limit === null ? null : limit + 1;
  const res = await pool.query(
    `SELECT p.*,
            pv.vote AS user_vote
     FROM posts p
     LEFT JOIN post_votes pv
       ON pv.post_id = p.id AND pv.user_id = $1
     WHERE p.status = 'pending'
       AND p.type <> 'answer'
       AND (
         $2::timestamptz IS NULL
         OR p.created_at < $2::timestamptz
         OR (p.created_at = $2::timestamptz AND p.id < $3::integer)
       )
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $4`,
    [userId, before, beforeId, queryLimit]
  );

  const hasMore = limit !== null && res.rows.length > limit;
  const posts = hasMore ? res.rows.slice(0, limit) : res.rows;
  const lastPost = posts.at(-1);

  return {
    posts,
    hasMore,
    nextCursor: hasMore && lastPost
      ? { before: lastPost.created_at, beforeId: lastPost.id }
      : null,
  };
};
