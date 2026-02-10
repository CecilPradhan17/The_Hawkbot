/**
 * register.controllers.js
 *
 * Purpose:
 * - Handles HTTP POST requests for user registration
 * - Acts as the intermediary between registration routes and the database service
 *
 * Responsibilities:
 * - Extracts and validates user registration data from the request body
 * - Calls the service layer to create a new user in the database
 * - Sends appropriate HTTP responses back to the client
 * - Handles duplicate user and server errors
 *
 * Used by:
 * - register.routes.js (for POST /api/register)
 *
 * Dependencies:
 * - createUserInDB: service function responsible for persisting user data
 *
 * Validation:
 * - Ensures email, username, and password are provided
 *
 * Error handling:
 * - Returns 400 if required registration fields are missing
 * - Returns 409 if the user already exists
 * - Returns 500 for unexpected server or database errors
 *
 * Notes:
 * - Password hashing and database logic should remain in the service layer
 * - Controllers should remain focused on HTTP request/response handling
 */

import { createUserInDB } from "../services/register.services.js";

export const registerUser = async (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password){
        return res.status(400).json({message: "Information is required"});
    }

    try{
        await createUserInDB({email, username, password});
        res.status(201).json({
            message: "User created",
        });
    }
    catch(error){
        if (error.message === "User already exists") {
            return res.status(409).json({ message: error.message });
        }

        res.status(500).json({ "error": error.message });
    }
};