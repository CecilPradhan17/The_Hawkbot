/**
 * displayPost.routes.js
 *
 * Purpose:
 * - Defines HTTP routes for retrieving a single post
 * - Maps requests with a post ID to the appropriate controller
 *
 * Responsibilities:
 * - Handles routing for fetching one specific post
 * - Extracts the post ID from the URL parameters
 * - Delegates request handling to the controller layer
 *
 * Routes:
 * - GET /:id
 *   - Triggers the displayOnePost controller
 *   - Expects a post ID as a route parameter
 *
 * Used by:
 * - routes/index.js (mounted under a base path, e.g., /api/displayPost)
 *
 * Notes:
 * - This file should only contain routing logic
 * - No database or business logic should exist here
 * - Keeps routing modular and scalable as more post-related routes are added
 */


import express from 'express';
import { displayOnePost } from '../controllers/displayPost.controllers.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get("/:id", requireAuth, displayOnePost);

export default router;