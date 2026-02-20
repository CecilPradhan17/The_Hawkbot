import express from "express";
import { handleChat } from "../controllers/chatbot.controllers.js";
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

router.post("/chat", requireAuth, chatLimiter, handleChat);

export default router;