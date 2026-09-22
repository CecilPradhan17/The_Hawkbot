/**
 * display.controllers.js
 *
 * Purpose:
 * - Handles HTTP GET requests for retrieving posts
 * - Acts as the intermediary between routes and the database service
 *
 * Responsibilities:
 * - Validates pagination parameters and fetches one page from the database
 * - Sends appropriate HTTP responses back to the client
 * - Handles errors from the database service
 *
 * Used by:
 * - display.routes.js (for GET /api/display)
 *
 * Dependencies:
 * - displayAllPostsFromDB: service function that fetches all posts from the database
 *
 * Error handling:
 * - Returns 500 if a database or server error occurs
 *
 * Notes:
 * - Controllers should remain lightweight and avoid direct database queries
 * - Keeps business logic separated in the service layer
 */

import { displayPostsPageFromDB } from "../services/display.services.js";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export const displayAllPosts = async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const before = typeof req.query.before === 'string' ? req.query.before : null;
    const beforeId = Number.parseInt(req.query.beforeId, 10);

    if ((before && !Number.isInteger(beforeId)) || (!before && req.query.beforeId)) {
      return res.status(400).json({ message: 'before and beforeId must be provided together' });
    }
    if (before && Number.isNaN(Date.parse(before))) {
      return res.status(400).json({ message: 'before must be a valid timestamp' });
    }

    const page = await displayPostsPageFromDB(req.user.id, {
      limit,
      before,
      beforeId: before ? beforeId : null,
    });
    res.status(200).json(page);
  } catch (error) {
    next(error);
  }
};
