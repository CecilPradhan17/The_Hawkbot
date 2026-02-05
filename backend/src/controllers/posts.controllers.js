/**
 * posts.controllers.js
 *
 * Purpose:
 * - Handles HTTP requests related to posts
 * - Acts as the middle layer between routes and database services
 *
 * Responsibilities:
 * - Validates incoming request data
 * - Calls service-layer functions to interact with the database
 * - Sends appropriate HTTP responses back to the client
 *
 * Used by:
 * - posts.routes.js (for POST /api/posts)
 *
 * Dependencies:
 * - createPostInDB: handles the actual database insertion logic
 *
 * Error handling:
 * - Returns 400 if required input is missing
 * - Returns 500 if a database or server error occurs
 *
 * Notes:
 * - Controllers should stay lightweight and avoid direct DB queries
 * - All business/data logic is delegated to the service layer
 */

import { createPostInDB } from "../services/posts.services.js";

export const createPost = async (req, res) => {
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content){
        return res.status(400).json({message: "Content is required"});
    }

    try{
        const post = await createPostInDB({content, author_id: authorId});
        res.status(201).json({
            message: "Post created",
            post: post,
        });
    }
    catch(error){
        console.log(error);
        res.status(500).json({ message: "Database error" });
    }
};