import express from "express";
import { handleChat } from "../controllers/chatbot.controllers.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

/**
 * PURPOSE:
 * Registers the chatbot route.
 *
 * ROUTES:
 * POST /api/chat - send a message to the chatbot (authenticated)
 */
const router = express.Router();

router.post("/", authenticateToken, handleChat);

export default router;