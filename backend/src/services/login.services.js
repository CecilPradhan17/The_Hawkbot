/**
 * login.services.js
 *
 * Purpose:
 * - Contains database and authentication logic for user login
 * - Encapsulates credential verification and password comparison
 *
 * Responsibilities:
 * - Retrieves a user record from the database using email
 * - Verifies the provided password against the stored hash
 * - Returns non-sensitive user information upon successful authentication
 *
 * Used by:
 * - login.controllers.js
 *
 * Function:
 * - loginUserInDB({ email, password })
 *   - Accepts user login credentials
 *   - Fetches the user by email
 *   - Compares the provided password with the stored bcrypt hash
 *   - Returns public user data if authentication succeeds
 *
 * Security notes:
 * - Passwords are never returned to the controller
 * - Uses bcrypt to safely compare password hashes
 * - Returns generic authentication errors to avoid leaking sensitive info
 *
 * Error handling:
 * - Throws an error if the user does not exist
 * - Throws an error if the password does not match
 *
 * Notes:
 * - Token generation (JWT/session) should be added in the controller or a dedicated auth service
 * - Database access and authentication logic remain isolated from HTTP handling
 */

import pool from "../db.js";
import bcrypt from "bcrypt";

export const loginUserInDB = async ({email, password}) => {
        const res = await pool.query(`SELECT id, email, username, password_hash FROM users 
            WHERE email = $1;`,
            [email]);
        
        const user = res.rows[0];

        if (!user){
            throw new Error ("Invalid credentials");
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            throw new Error("Invalid password");
        }

        return {
            id: user.id,
            email: user.email,
            username: user.username
        };
};
