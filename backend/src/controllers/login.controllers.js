/**
 * login.controllers.js
 *
 * Purpose:
 * - Handles HTTP POST requests for user authentication (login)
 * - Acts as the intermediary between login routes and authentication services
 *
 * Responsibilities:
 * - Extracts and validates login credentials from the request body
 * - Calls the service layer to authenticate the user
 * - Sends appropriate HTTP responses back to the client
 *
 * Used by:
 * - login.routes.js (for POST /api/login)
 *
 * Dependencies:
 * - loginUserInDB: service function responsible for verifying user credentials
 *
 * Validation:
 * - Ensures email and password are provided
 *
 * Error handling:
 * - Returns 400 if required login fields are missing
 * - Returns 500 for authentication or server errors
 *
 * Notes:
 * - Password verification and user lookup should occur in the service layer
 * - Controllers should remain focused on request/response handling
 * - Token generation (JWT, sessions) can be added here or in a dedicated auth service
 */

import { loginUserInDB } from "../services/login.services.js";

export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        const error = new Error("Email and password are required");
        error.status = 400;
        return next(error);
    }

    try {
        const user = await loginUserInDB({ email, password });
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};
