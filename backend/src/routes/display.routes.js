/**
 * display.routes.js
 *
 * Purpose:
 * - Defines HTTP routes for retrieving posts
 * - Maps incoming GET requests to the appropriate controller
 *
 * Responsibilities:
 * - Handles routing for displaying all posts
 * - Delegates request handling to the controller layer
 *
 * Routes:
 * - GET / 
 *   - Triggers the displayAllPosts controller
 *
 * Used by:
 * - routes/index.js (mounted under a base path, e.g., /api/display)
 *
 * Notes:
 * - This file should not contain any database or business logic
 * - Keeps routing logic separated for maintainability and scalability
 */


import express from 'express';
import { displayAllPosts } from '../controllers/display.controllers.js';

const router = express.Router();

router.get("/", displayAllPosts);

export default router;