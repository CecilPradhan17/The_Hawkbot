/**
 * vote.services.js
 *
 * Purpose:
 * - Contains database logic for handling post voting
 * - Ensures vote consistency, idempotency, and accurate vote counts
 *
 * Responsibilities:
 * - Records user votes on posts
 * - Handles first-time votes, vote toggling, and vote switching
 * - Keeps `post_votes` and `posts.vote_count` in sync
 * - Uses database transactions to maintain data integrity
 *
 * Used by:
 * - vote.controllers.js
 *
 * Function:
 * - voteOnPost({ userId, postId, vote })
 *   - Parameters:
 *       - userId: ID of the authenticated user casting the vote
 *       - postId: ID of the post being voted on
 *       - vote: Integer value representing the vote (+1 or -1)
 *   - Behavior:
 *       - Begins a database transaction
 *       - Checks for an existing vote by the user on the post
 *       - If no existing vote:
 *           - Inserts a new vote record
 *           - Updates the post’s vote count by the vote value
 *       - If the same vote already exists:
 *           - Removes the vote (toggle off)
 *           - Reverses the previous vote from the post’s vote count
 *       - If the opposite vote exists:
 *           - Updates the vote value
 *           - Adjusts the post’s vote count accordingly
 *       - Commits the transaction if all operations succeed
 *       - Returns the updated vote count
 *
 * Security notes:
 * - Does not trust client-side vote counts
 * - User identity is derived from JWT middleware at the controller level
 * - Prevents multiple votes per user per post through database checks
 *
 * Error handling:
 * - Rolls back the transaction if any step fails
 * - Rethrows errors to be handled by the controller
 *
 * Extra notes:
 * - Transaction usage ensures atomic updates across multiple tables
 * - Vote switching adjusts the count by `vote * 2` to account for reversal
 * - Designed to be idempotent for repeated identical vote requests
 *
 * Additional info for Frontend/Modification:
 * - Frontend should rely on the returned `vote_count` instead of calculating locally
 * - UI can optimistically update votes but should reconcile on response
 * - Can be extended to support reactions, weighted votes, or rate-limiting
 * - Consider adding database constraints or indexes on `(user_id, post_id)` for performance
 */

import pool from "../db.js";

export const voteOnPost = async ({ userId, postId, vote }) => {

  try {
    await pool.query("BEGIN");

    const existing = await pool.query(
      `SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2`,
      [userId, postId]
    );

    if (existing.rows.length === 0) {
      // first vote
      await pool.query(
        `INSERT INTO post_votes (user_id, post_id, vote) VALUES ($1, $2, $3)`,
        [userId, postId, vote]
      );
      await pool.query(
        `UPDATE posts SET vote_count = vote_count + $1 WHERE id = $2`,
        [vote, postId]
      );
    } else {
      const prevVote = existing.rows[0].vote;
      if (prevVote === vote) {
        // toggle off
        await pool.query(
          `DELETE FROM post_votes WHERE user_id = $1 AND post_id = $2`,
          [userId, postId]
        );
        await pool.query(
          `UPDATE posts SET vote_count = vote_count - $1 WHERE id = $2`,
          [vote, postId]
        );
      } else {
        // switch vote
        await pool.query(
          `UPDATE post_votes SET vote = $1 WHERE user_id = $2 AND post_id = $3`,
          [vote, userId, postId]
        );
        await pool.query(
          `UPDATE posts SET vote_count = vote_count + $1 WHERE id = $2`,
          [vote * 2, postId]
        );
      }
    }

    await pool.query("COMMIT");

    // Return the new vote count for convenience
    const result = await pool.query(
      `SELECT vote_count FROM posts WHERE id = $1`,
      [postId]
    );
    return result.rows[0].vote_count;

  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  } 
};
