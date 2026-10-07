import express from "express";
import { getHawkWallSource, handleChat, reportOutdated } from "../controllers/chatbot.controllers.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { chatLimiter } from "../middleware/rateLimiter.js";

/**
 * PURPOSE:
 * Registers the chatbot route.
 *
 * Middleware order matters:
 * 1. authenticateToken — verifies JWT and sets req.user
 * 2. chatLimiter — rate limits by req.user.id (requires step 1 first)
 * 3. handleChat — processes the request
 *
 * ROUTES:
 * POST /api/chat
 */
const router = express.Router();

router.post("/", requireAuth, chatLimiter, handleChat);
router.post("/outdated", requireAuth, reportOutdated);
router.get("/source/:postId", requireAuth, getHawkWallSource);

export default router;
