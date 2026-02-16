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
 * - Returns 400 if required input is missing or input exceed limit
 * - Returns 500 if a database or server error occurs
 *
 * Notes:
 * - Controllers should stay lightweight and avoid direct DB queries
 * - All business/data logic is delegated to the service layer
 */

import { createPostInDB } from "../services/posts.services.js";

export const createPost = async (req, res, next) => {
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content || !content.trim()) {
        const error = new Error("Content is required");
        error.status = 400;
        return next(error);
    }

    if (content.length > 500) {
        const error = new Error("Content exceeds maximum length of 500 characters");
        error.status = 400;
        return next(error);
    }

    try {
        const post = await createPostInDB({
            content,
            author_id: authorId
        });

        res.status(201).json(post);

    } catch (error) {
        next(error); 
    }
};
