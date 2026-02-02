/**
 * posts.services.js
 *
 * Purpose:
 * - Contains all database-related logic for post operations
 * - Isolates raw SQL queries from controllers
 *
 * Responsibilities:
 * - Interacts directly with the PostgreSQL database
 * - Executes queries and returns processed results to controllers
 *
 * Used by:
 * - posts.controllers.js
 *
 * Function:
 * - createPostInDB({content, author_id})
 *   - Inserts a new post into the `posts` table
 *   - Returns the newly created post using `RETURNING *`
 *
 * Notes:
 * - No HTTP logic or request/response handling should exist here
 * - Errors are allowed to bubble up to the controller for handling
 * - Keeps controllers clean and easier to test or refactor
 */

import pool from "../db.js";

export const createPostInDB = async ({content, author_id}) => {
        const res = await pool.query(`INSERT INTO posts (content, author_id) VALUES ($1, $2) RETURNING *;`,[content, author_id]);
        return res.rows[0];    
}