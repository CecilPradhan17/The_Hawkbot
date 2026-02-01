/**
 * delete.controllers.js
 *
 * Purpose:
 * - Handles HTTP DELETE requests related to posts
 * - Acts as the intermediary between routes and database services
 *
 * Responsibilities:
 * - Validates incoming request data (ensures `content` is provided)
 * - Calls service-layer functions to delete posts from the database
 * - Returns appropriate HTTP responses to the client
 *
 * Used by:
 * - delete.routes.js (for DELETE /api/delete)
 *
 * Dependencies:
 * - deletePostInDB: performs the actual deletion in the database
 *
 * Error handling:
 * - Returns 400 if the required `content` field is missing
 * - Returns 500 if a database or server error occurs
 *
 * Notes:
 * - Controllers should remain lightweight and avoid direct DB queries
 * - All business logic is delegated to the service layer
 */

import { deletePostInDB } from "../services/delete.services.js";

export const deletePost = async (req, res) => {
    const { content } = req.body;

    if (!content){
        return res.status(400).json({message: "Content is required"});
    }

    try{
        const post = await deletePostInDB(content);
        res.status(201).json({
            message: "Post deleted",
            post: post,
        });
    }
    catch(error){
        console.log(error);
        res.status(500).json({ message: "Database error" });
    }
};