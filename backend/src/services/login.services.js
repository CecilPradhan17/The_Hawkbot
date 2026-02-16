/**
 * login.services.js
 *
 * Purpose:
 * - Contains database and authentication logic for user login
 * - Encapsulates credential verification, password comparison, and JWT token generation
 *
 * Responsibilities:
 * - Retrieves a user record from the database using email
 * - Verifies the provided password against the stored hash
 * - Generates a signed JWT upon successful authentication
 * - Returns non-sensitive user information along with the token
 *
 * Used by:
 * - login.controllers.js
 *
 * Function:
 * - loginUserInDB({ email, password })
 *   - Accepts user login credentials
 *   - Fetches the user by email from the database
 *   - Compares the provided password with the stored bcrypt hash
 *   - Generates a JWT containing the user ID and email if authentication succeeds
 *   - Returns an object with the JWT and public user data
 *
 * Security notes:
 * - Passwords are never returned to the controller
 * - Uses bcrypt to safely compare password hashes
 * - Returns generic authentication errors to avoid leaking sensitive info
 * - JWT signing uses a secret stored in environment variables (`JWT_SECRET`) and expiration time (`JWT_EXPIRES_IN`)
 *
 * Error handling:
 * - Throws an error if the user does not exist
 * - Throws an error if the password does not match
 
 * Extra notes:
 * - Token generation is now part of the service, so controllers can immediately send the token to the frontend
 * - Database access and authentication logic remain isolated from HTTP handling
 *
 * Additional info for Frontend/Modification:
 * - The frontend can include the returned JWT in Authorization headers for protected routes
 * - You can extend the payload in the token to include roles, permissions, or other claims for access control
 * - Modifications could include refresh token logic or support for multiple login methods
 */


import pool from "../db.js";
import bcrypt from "bcrypt";
import { signToken } from "../utils/jwt.js";

export const loginUserInDB = async ({email, password}) => {
        const res = await pool.query(`SELECT id, email, username, password_hash FROM users 
            WHERE email = $1;`,
            [email]);
        
        const user = res.rows[0];

        if (!user) {
        const error = new Error("Invalid email or password");
        error.status = 401;
        throw error;
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
        const error = new Error("Invalid email or password");
        error.status = 401;
        throw error;
        }

        const token = signToken({
            id: user.id,
            email: user.email
        });

        return {
            token,
            id: user.id,
            email: user.email,
            username: user.username
        };
};
