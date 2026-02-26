/**
 * displayPost.services.js
 *
 * Purpose:
 * - Contains database logic for retrieving a single post by ID
 * - Encapsulates raw SQL queries related to fetching individual posts
 *
 * Responsibilities:
 * - Executes a SELECT query to retrieve a post matching the provided ID and status is pending
 * - Returns the matching post object to the controller
 *
 * Used by:
 * - displayPost.controllers.js
 *
 * Function:
 * - displayOnePostFromDB(id)
 *   - Accepts a post ID as an argument
 *   - Queries the `posts` table for a matching record
 *   - Returns a single post object or undefined if not found
 *
 * Notes:
 * - No HTTP request/response logic should exist here
 * - Errors are allowed to bubble up to the controller
 * - Keeps data access concerns isolated from routing and controllers
 */

import pool from "../db.js";

export const displayOnePostFromDB = async (id, userId) => {
  const postRes = await pool.query(
    `SELECT p.*,
            pv.vote AS user_vote
     FROM posts p
     LEFT JOIN post_votes pv
       ON pv.post_id = p.id AND pv.user_id = $2
     WHERE p.id = $1
       AND p.status = 'pending'`,
    [id, userId]
  );

  if (postRes.rows.length === 0) return null;

  const post = postRes.rows[0];

  if (post.type !== "question") {
    return { post };
  }

  const answersRes = await pool.query(
    `SELECT p.*,
            pv.vote AS user_vote
     FROM posts p
     LEFT JOIN post_votes pv
       ON pv.post_id = p.id AND pv.user_id = $2
     WHERE p.parent_id = $1
       AND p.status = 'pending'
     ORDER BY p.created_at ASC`,
    [id, userId]
  );

  return {
    post,
    answers: answersRes.rows,
  };
};
