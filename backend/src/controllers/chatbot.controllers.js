import { handleChatQuery } from "../services/chatbot.services.js";

/**
 * PURPOSE:
 * Handles incoming chatbot queries from the frontend.
 *
 * ROUTE: POST /api/chat
 * BODY: { message: string }
 * RESPONSE: { response: string, matched: boolean }
 *
 * USED BY:
 * chatbot.routes.js
 */
export const handleChat = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      const error = new Error("Message is required");
      error.status = 400;
      return next(error);
    }

    const result = await handleChatQuery(message.trim());

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};