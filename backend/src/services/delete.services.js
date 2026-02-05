/**
 * delete.services.js
 *
 * Purpose:
 * - Contains database logic related to post deletion and ownership verification
 * - Isolates raw SQL queries from controllers to maintain separation of concerns
 *
 * Responsibilities:
 * - Deletes a post from the `posts` table using its ID
 * - Retrieves the author ID of a post for authorization checks
 * - Returns database results to the controller without HTTP-specific logic
 *
 * Used by:
 * - delete.controllers.js
 *
 * Functions:
 * - deletePostInDB(id)
 *   - Parameters:
 *       - id: ID of the post to be deleted
 *   - Behavior:
 *       - Executes a DELETE query on the `posts` table
 *       - Uses `RETURNING *` to return the deleted post record
 *   - Returns:
 *       - The deleted post row, or `undefined` if no post was deleted
 *
 * - getAuthorIdByPost(id)
 *   - Parameters:
 *       - id: ID of the post to look up
 *   - Behavior:
 *       - Queries the database for the `author_id` of the given post
 *   - Returns:
 *       - An object containing `{ author_id }`, or `undefined` if the post does not exist
 *
 * Security notes:
 * - Does not perform authentication or authorization checks directly
 * - Authorization is enforced at the controller level using JWT-derived user data
 *
 * Error handling:
 * - Database errors are not caught here and are allowed to propagate to the controller
 *
 * Extra notes:
 * - This service is intentionally database-focused and reusable
 * - Can be used by other controllers that need post ownership information
 *
 * Additional info for Frontend/Modification:
 * - Frontend will never interact with this layer directly
 * - If modifying, consider wrapping related post queries into a single transaction if future features require it
 * - Can be extended to support soft deletes or admin-level overrides without changing controller logic
 */


import pool from "../db.js";

export const deletePostInDB = async (id) => {
        const res = await pool.query(`DELETE FROM posts WHERE id = $1 RETURNING *;`,[id]);
        return res.rows[0];    
};

export const getAuthorIdByPost = async (id) => {
        const res = await pool.query('SELECT author_id FROM posts WHERE id = $1;',[id]);
        return res.rows[0];
};