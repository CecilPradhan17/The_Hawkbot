/**
 * register.services.js
 *
 * Purpose:
 * - Contains database and security logic for user registration
 * - Encapsulates password hashing and user creation
 *
 * Responsibilities:
 * - Hashes the user's password using bcrypt before storage
 * - Inserts a new user record into the `users` table
 * - Returns non-sensitive user information after creation
 *
 * Used by:
 * - register.controllers.js
 *
 * Function:
 * - createUserInDB({ email, username, password })
 *   - Accepts user registration data
 *   - Hashes the plaintext password
 *   - Stores the hashed password in the database
 *   - Returns the created user's public fields (email, username)
 *
 * Security notes:
 * - Passwords are never stored in plaintext
 * - Only non-sensitive fields are returned to the controller
 *
 * Notes:
 * - Database errors (e.g., duplicate users) should be handled by the controller
 * - This layer should not contain HTTP request/response logic
 */

import pool from "../db.js";
import bcrypt from "bcrypt";

export const createUserInDB = async ({email, username, password}) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const res = await pool.query(`INSERT INTO users (username, email, password_hash) 
            VALUES ($1, $2, $3) RETURNING email, username ;`,
            [username, email, hashedPassword]);
        return res.rows[0];    
}