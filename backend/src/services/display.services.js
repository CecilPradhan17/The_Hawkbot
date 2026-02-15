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

export const displayAllPostsFromDB = async () => {
        const res = await pool.query(`SELECT * FROM posts WHERE status = 'pending' ORDER BY created_at DESC;`);
        return res.rows;    
}