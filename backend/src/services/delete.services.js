/**
 * delete.services.js
 *
 * Purpose:
 * - Contains database logic for deleting posts
 * - Isolates raw SQL queries from controllers
 *
 * Responsibilities:
 * - Executes a DELETE query on the `posts` table based on post ID
 * - Returns the deleted post record to the controller
 *
 * Used by:
 * - delete.controllers.js
 *
 * Function:
 * - deletePostInDB(content)
 *   - Deletes a post with the given `id` (ID) from the database
 *   - Uses `RETURNING *` to return the deleted row
 *
 * Notes:
 * - No HTTP logic or validation occurs here
 * - Errors are allowed to bubble up to the controller for handling
 * - Keeps the controller lightweight and focused on request/response
 */


import pool from "../db.js";

export const deletePostInDB = async (id) => {
        const res = await pool.query(`DELETE FROM posts WHERE id = $1 RETURNING *;`,[id]);
        return res.rows[0];    
}