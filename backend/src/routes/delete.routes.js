/**
 * delete.routes.js
 *
 * Purpose:
 * - Defines HTTP routes related to deleting posts
 *
 * Responsibilities:
 * - Maps incoming DELETE requests to the appropriate controller
 * - Does not contain business logic or database queries
 * - requireAuth to check if the client token is authorized
 *
 * Routes:
 * - DELETE /
 *   - Triggers the deletePost controller
 *
 * Used by:
 * - routes/index.js (mounted under a base path, e.g. /api/delete)
 *
 * Notes:
 * - Keeps routing logic separate from controllers and services
 * - Makes it easy to extend delete-related endpoints in the future
 */

import express from 'express';
import { deletePost } from '../controllers/delete.controllers.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.delete("/:id", requireAuth, deletePost);

export default router;