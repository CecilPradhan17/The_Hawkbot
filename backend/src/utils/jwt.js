/**
 * Purpose:
 *  - To provide a utility function for generating JSON Web Tokens (JWTs) for authentication purposes.
 * 
 * Responsibilities:
 *  - Sign a payload with a secret key to create a JWT.
 *  - Apply an expiration time to the token based on environment configuration.
 * 
 * Used by:
 *  - login.services.js
 * 
 * Functions:
 *  - signToken(payload)
 *      - Parameters:
 *          - payload: Object containing the data to encode into the JWT (user id, email).
 *      - Returns:
 *          - A signed JWT string.
 *      - Behavior:
 *          - Uses the JWT secret from environment variables (`process.env.JWT_SECRET`).
 *          - Sets token expiration using `process.env.JWT_EXPIRES_IN`.
 * 
 * Extra Notes:
 *  - This module relies on the `jsonwebtoken` package and environment variables configured via `.env`.
 *  - Ensure `JWT_SECRET` is strong and kept private.
 *  - Expiration format in `JWT_EXPIRES_IN` should follow the `jsonwebtoken` library standards (e.g., "1h", "7d").
 * 
 * Additional Info for Frontend/Modification:
 *  - The frontend can store this token in localStorage or cookies and include it in Authorization headers for authenticated requests.
 *  - If modifying, you could add options for different signing algorithms or include refresh token logic.
 *  - Can be extended to include roles/permissions or other metadata in the payload for client-side access control.
 */

import jwt from "jsonwebtoken";
import 'dotenv/config';

export const signToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};