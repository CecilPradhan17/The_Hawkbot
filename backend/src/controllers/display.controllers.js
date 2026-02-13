/**
 * display.controllers.js
 *
 * Purpose:
 * - Handles HTTP GET requests for retrieving posts
 * - Acts as the intermediary between routes and the database service
 *
 * Responsibilities:
 * - Calls the service layer to fetch all posts from the database
 * - Sends appropriate HTTP responses back to the client
 * - Handles errors from the database service
 *
 * Used by:
 * - display.routes.js (for GET /api/display)
 *
 * Dependencies:
 * - displayAllPostsFromDB: service function that fetches all posts from the database
 *
 * Error handling:
 * - Returns 500 if a database or server error occurs
 *
 * Notes:
 * - Controllers should remain lightweight and avoid direct database queries
 * - Keeps business logic separated in the service layer
 */


import { displayAllPostsFromDB } from "../services/display.services.js";

export const displayAllPosts = async (req, res) => {

    try{
        const posts = await displayAllPostsFromDB();
        res.status(200).json(posts);
    }
    catch(error){
        console.log(error);
        res.status(500).json({ message: "Database error" });
    }
};