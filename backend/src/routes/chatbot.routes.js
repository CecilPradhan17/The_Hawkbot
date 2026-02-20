import express from "express";
import { handleChat } from "../controllers/chatbot.controllers.js";
import { requireAuth } from "../middleware/auth.middleware.js";

/**
 * PURPOSE:
 * Registers the chatbot route.
 *
 * ROUTES:
 * POST /api/chat - send a message to the chatbot (authenticated)
 */
const router = express.Router();

router.post("/", requireAuth, handleChat);

export default router;