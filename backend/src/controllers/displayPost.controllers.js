/**
 * displayPost.controllers.js
 *
 * Purpose:
 * - Handles HTTP GET requests for retrieving a single post by ID
 * - Acts as the intermediary between routes and the database service
 *
 * Responsibilities:
 * - Extracts the post ID from route parameters
 * - Validates the presence of the ID
 * - Calls the service layer to fetch the post from the database
 * - Sends an appropriate HTTP response back to the client
 * - Handles errors from the database service
 *
 * Used by:
 * - displayPost.routes.js (for GET /:id)
 *
 * Dependencies:
 * - displayOnePostFromDB: service function that retrieves a post by ID
 *
 * Error handling:
 * - Returns 400 if the ID is missing
 * - Returns 500 if a database or server error occurs
 *
 * Notes:
 * - Controllers should remain lightweight and avoid direct database queries
 * - Business and data access logic should remain in the service layer
 */

import { displayOnePostFromDB } from "../services/displayPost.services.js";

export const displayOnePost = async (req, res) => {

    const { id } = req.params;

    if (!id){
        return res.status(400).json({message: "id is required"});
    }

    try{
        const post = await displayOnePostFromDB(id);
        if (!post){
            res.status(200).json({
                message: "Post has been hidded"
        });
        }
        res.status(200).json(post);
    }
    catch(error){
        console.log(error);
        res.status(500).json({ message: "Database error" });
    }
};