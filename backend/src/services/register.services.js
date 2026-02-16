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
 *
 * Used by:
 * - register.controllers.js
 *
 * Function:
 * - createUserInDB({ email, username, password })
 *   - Accepts user registration data
 *   - Hashes the plaintext password
 *   - Stores the hashed password in the database
 * 
 * Security notes:
 * - Passwords are never stored in plaintext
 *
 * Notes:
 * - Database errors (e.g., duplicate users) should be handled by the controller
 * - This layer should not contain HTTP request/response logic
 */

import pool from "../db.js";
import bcrypt from "bcrypt";

export const createUserInDB = async ({ email, username, password }) => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `INSERT INTO users (username, email, password_hash) 
             VALUES ($1, $2, $3);`,
            [username, email, hashedPassword]
        );

    } catch (error) {
        if (error.code === "23505") {
            const err = new Error("Email already registered");
            err.status = 409;
            throw err;
        }

        throw error;
    }
};
