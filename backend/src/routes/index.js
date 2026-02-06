/**
 * routes/index.js
 *
 * Purpose:
 * - Acts as the central router for the application
 * - Combines and organizes all feature-specific route modules
 *
 * Responsibilities:
 * - Groups routes by feature/domain (posts, delete, etc.)
 * - Mounts sub-routers under their respective base paths
 *
 * Used by:
 * - app.js (mounted under /api)
 *
 * Routes exposed:
 * - /api/posts  -> handled by posts.routes.js 
 * - /api/delete/:id -> handled by delete.routes.js
 * - /api/display -> handled by display.routes.js
 * - /api/displayPost/:id -> handled by displayPost.routes.js
 * - /api/register -> handled by register.routes.js
 * - /api/login -> handled by register.routes.js
 *
 * Notes:
 * - Keeps route registration centralized and readable
 * - Makes adding new route modules easy as the app scales
 * - Avoids cluttering app.js with feature-specific routes
 */

import express from 'express';
import postsRoutes from './posts.routes.js';
import deleteRoutes from './delete.routes.js';
import displayRoutes from './display.routes.js';
import displayPostRoutes from './displayPost.routes.js';
import registerRoutes from './register.routes.js';
import loginRoutes from './login.routes.js';

const router = express.Router();

router.use("/posts", postsRoutes);
router.use("/delete", deleteRoutes);
router.use("/display", displayRoutes);
router.use("/displayPost", displayPostRoutes);
router.use("/register", registerRoutes);
router.use("/login", loginRoutes);

export default router;

