/**
 * delete.controllers.js
 *
 * Purpose:
 * - Handles HTTP DELETE requests related to posts
 * - Acts as the controller layer between routes, authentication middleware, and database services
 *
 * Responsibilities:
 * - Extracts the post ID from request parameters
 * - Ensures the post exists before attempting deletion
 * - Enforces authorization by verifying the authenticated user owns the post
 * - Calls service-layer functions to delete the post from the database
 * - Returns appropriate HTTP responses to the client
 *
 * Used by:
 * - delete.routes.js (DELETE /api/delete/:id)
 * - requireAuth middleware (must run before this controller)
 *
 * Function:
 * - deletePost(req, res)
 *   - Parameters:
 *       - req: Express request object (expects `req.user` from JWT middleware)
 *       - res: Express response object
 *   - Behavior:
 *       - Retrieves `id` from `req.params`
 *       - Fetches the post’s `author_id` from the database
 *       - Compares `author_id` with `req.user.id` from the decoded JWT
 *       - Deletes the post only if the authenticated user is the owner
 *       - Returns success or error responses accordingly
 *
 * Security notes:
 * - Relies on JWT authentication via `requireAuth` to identify the user
 * - Prevents users from deleting posts they do not own
 * - Uses server-side authorization checks rather than trusting client input
 *
 * Error handling:
 * - Returns 404 if the post does not exist
 * - Returns 403 if the authenticated user is not the post owner
 * - Returns 500 for unexpected server or database errors
 *
 * Extra notes:
 * - Assumes `requireAuth` middleware is applied at the route level
 * - Authorization logic is handled in the controller, while deletion logic remains in the service layer
 *
 * Additional info for Frontend/Modification:
 * - Frontend must send a valid JWT in the Authorization header to access this endpoint
 * - UI should handle 403 responses to indicate lack of permission
 * - Can be extended to support admin-level deletion or soft deletes (e.g., marking posts as deleted)
 */

import { deletePostInDB, getAuthorIdByPost } from "../services/delete.services.js";

export const deletePost = async (req, res) => {
    try {    
        const { id } = req.params;

        const post = await getAuthorIdByPost(id);

        if (!post){
            return res.status(404).json({message:"Post not found"});
        }

        if (post.author_id != req.user.id){
            return res.status(403).json({message:"Not authorized"});
        }

        const answer = await deletePostInDB(id);

        res.status(200).json({
            message: "Post deleted",
            answer
        });
    }
    catch(error){
        res.status(500).json({ message: error.message});
    }
};