import { handleChatQuery } from "../services/chatbot.services.js";
import { reportKnowledgeOutdated } from "../services/knowledge-feedback.services.js";
import { getApprovedHawkWallSource } from "../services/hawkwall-source.services.js";

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

    if (message.trim().length > 250) {
      const error = new Error("Message must be 250 characters or fewer");
      error.status = 400;
      return next(error);
    }

    const result = await handleChatQuery(message.trim());

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const reportOutdated = async (req, res, next) => {
  try {
    const { knowledgeIds } = req.body || {};
    if (!Array.isArray(knowledgeIds)) {
      const error = new Error("knowledgeIds must be an array");
      error.status = 400;
      return next(error);
    }
    const result = await reportKnowledgeOutdated({ userId: req.user.id, knowledgeIds });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getHawkWallSource = async (req, res, next) => {
  try {
    const sourcePostId = Number(req.params.postId);
    if (!Number.isInteger(sourcePostId) || sourcePostId <= 0) {
      const error = new Error("A valid source post ID is required");
      error.status = 400;
      return next(error);
    }
    const source = await getApprovedHawkWallSource(sourcePostId, req.user.id);
    if (!source) {
      const error = new Error("HawkWall source not found");
      error.status = 404;
      return next(error);
    }
    res.status(200).json(source);
  } catch (error) {
    next(error);
  }
};
