/**
 * login.routes.js
 *
 * Purpose:
 * - Defines HTTP routes for user authentication (login)
 * - Maps incoming login requests to the appropriate controller
 *
 * Responsibilities:
 * - Handles routing for user login requests
 * - Delegates authentication logic to the controller layer
 *
 * Routes:
 * - POST /
 *   - Triggers the loginUser controller
 *   - Expects user login credentials in the request body
 *
 * Used by:
 * - routes/index.js (mounted under a base path, e.g., /api/login)
 *
 * Notes:
 * - This file contains routing logic only
 * - Authentication and verification logic should reside in the controller/service layers
 * - Designed to be easily extended with additional auth routes (e.g., logout, refresh)
 */

import express from 'express';
import { loginUser } from '../controllers/login.controllers.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post("/", loginLimiter, loginUser);

export default router;