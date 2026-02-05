/**
 * posts.routes.js
 *
 * Purpose:
 * - Defines POST as HTTP route 
 * - Maps incoming requests to their corresponding controller functions
 *
 * Responsibilities:
 * - Handles routing and HTTP methods (POST)
 * - Delegates request handling logic to controllers
 * - adds authorization middleware
 *
 * Used by:
 * - routes/index.js (mounted under /api/posts)
 *
 * Calls:
 * - createPost controller to handle post creation logic
 * - requireAuth to check if the client token is authorized
 *
 * Notes:
 * - This file should NOT contain business logic
 * - Keep this file focused on route definitions only
 * - Makes the API easier to scale and maintain
 */

import express from 'express';
import { createPost } from '../controllers/posts.controllers.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/", requireAuth, createPost);

export default router;