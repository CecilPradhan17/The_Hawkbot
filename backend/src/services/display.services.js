/**
 * display.services.js
 *
 * Purpose:
 * - Contains database logic for retrieving posts
 * - Isolates raw SQL queries from controllers
 *
 * Responsibilities:
 * - Executes a SELECT query to fetch all posts from the `posts` table that have status pending
 * - Returns the results to the controller for HTTP response
 *
 * Used by:
 * - display.controllers.js
 *
 * Function:
 * - displayAllPostsFromDB()
 *   - Fetches all posts from the database
 *   - Returns an array of post objects
 *
 * Notes:
 * - No HTTP logic or request/response handling should occur here
 * - Keeps controllers lightweight and focused on request handling
 * - Errors are allowed to bubble up to the controller for handling
 */

import pool from "../db.js";

export const displayAllPostsFromDB = async (userId) => {
  const res = await pool.query(
    `SELECT p.*,
            pv.vote AS user_vote
     FROM posts p
     LEFT JOIN post_votes pv
       ON pv.post_id = p.id AND pv.user_id = $1
     WHERE p.status = 'pending'
       AND p.type <> 'answer'
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return res.rows;
};