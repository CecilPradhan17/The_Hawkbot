/**
 * register.routes.js
 *
 * Purpose:
 * - Defines HTTP routes for user registration
 * - Maps incoming registration requests to the appropriate controller
 *
 * Responsibilities:
 * - Handles routing for creating new user accounts
 * - Delegates request processing to the controller layer
 *
 * Routes:
 * - POST /
 *   - Triggers the registerUser controller
 *   - Expects user registration data in the request body
 *
 * Used by:
 * - routes/index.js (mounted under a base path, e.g., /api/register)
 *
 * Notes:
 * - This file contains routing logic only
 * - No validation, authentication, or database logic should exist here
 * - Keeps authentication-related routes modular and easy to expand
 */

import express from 'express';
import { registerUser } from '../controllers/register.controllers.js';

const router = express.Router();

router.post("/", registerUser);

export default router;