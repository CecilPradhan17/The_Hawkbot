/**
 * vote.controllers.js
 *
 * Purpose:
 * - Handles HTTP requests related to voting on posts
 * - Acts as the controller layer between routes, authentication middleware, and voting services
 *
 * Responsibilities:
 * - Extracts the authenticated user ID from the JWT middleware
 * - Validates vote input to ensure only allowed values are processed
 * - Delegates vote logic to the service layer
 * - Returns the updated vote count to the client
 *
 * Used by:
 * - vote.routes.js (e.g., POST /api/posts/:id/vote)
 * - requireAuth middleware (must run before this controller)
 *
 * Function:
 * - handleVote(req, res)
 *   - Parameters:
 *       - req: Express request object (expects `req.user.id` from JWT)
 *       - res: Express response object
 *   - Behavior:
 *       - Retrieves `userId` from the decoded JWT
 *       - Parses `postId` from route parameters
 *       - Validates `vote` value (+1 or -1 only)
 *       - Calls `voteOnPost` service to apply the vote
 *       - Returns the updated vote count
 *
 * Security notes:
 * - Requires JWT authentication to ensure votes are tied to real users
 * - Prevents unauthorized or anonymous voting
 * - Does not trust client-provided user IDs
 *
 * Error handling:
 * - Returns 400 if the vote value is invalid
 * - Returns 500 for unexpected server or database errors
 *
 * Extra notes:
 * - Input validation is kept minimal at the controller level
 * - Business rules (e.g., one vote per user per post) should be enforced in the service layer
 *
 * Additional info for Frontend/Modification:
 * - Frontend must send a valid JWT in the Authorization header
 * - Vote payload should be sent as `{ vote: 1 }` or `{ vote: -1 }`
 * - UI can optimistically update vote count but should reconcile with the server response
 * - Can be extended to support unvoting, vote toggling, or reaction-based voting
 */

import { voteOnPost } from "../services/vote.services.js";

export const handleVote = async (req, res) => {
  try {
    const userId = req.user.id;       // from JWT middleware
    const postId = parseInt(req.params.id);
    const { vote } = req.body;        // 1 or -1

    if (![1, -1].includes(vote)) {
      return res.status(400).json({ error: "Invalid vote value" });
    }

    const newVoteCount = await voteOnPost({ userId, postId, vote });
    res.status(200).json({ voteCount: newVoteCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};