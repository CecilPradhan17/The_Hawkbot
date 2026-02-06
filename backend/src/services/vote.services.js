/**
 * vote.services.js
 *
 * Purpose:
 * - Contains database logic for handling post voting and post status transitions
 * - Ensures vote consistency, idempotency, and controlled post approval workflow
 *
 * Responsibilities:
 * - Records user votes on posts
 * - Handles first-time votes, vote toggling, and vote switching
 * - Prevents voting on posts that are no longer pending
 * - Updates post status based on vote thresholds
 * - Keeps `post_votes`, `posts.vote_count`, and `posts.status` in sync
 * - Uses database transactions to maintain data integrity
 *
 * Used by:
 * - vote.controllers.js
 *
 * Functions:
 * - voteOnPost({ userId, postId, vote })
 *   - Parameters:
 *       - userId: ID of the authenticated user casting the vote
 *       - postId: ID of the post being voted on
 *       - vote: Integer value representing the vote (+1 or -1)
 *   - Behavior:
 *       - Begins a database transaction
 *       - Checks the current post status and blocks voting if status is not `pending`
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
 *       - Commits the transaction
 *       - Determines the new post status based on updated vote count
 *       - Updates post status if it has changed
 *       - Returns the updated vote count and post status
 *
 * - determinePostStatus(voteCount)
 *   - Parameters:
 *       - voteCount: Integer representing total votes on a post
 *   - Behavior:
 *       - Returns `"approved"` if vote count ≥ 1
 *       - Returns `"disapproved"` if vote count ≤ -1
 *       - Returns `"pending"` otherwise
 *
 * Security notes:
 * - Does not trust client-side vote or status values
 * - User identity is derived from JWT middleware at the controller level
 * - Prevents vote manipulation by enforcing one vote per user per post
 * - Prevents state changes once a post is no longer pending
 *
 * Error handling:
 * - Rolls back the entire transaction if any step fails
 * - Throws an error if voting is attempted on a non-pending post
 * - Rethrows errors to be handled by the controller
 *
 * Extra notes:
 * - Status transitions are derived purely from vote count thresholds
 * - Post status updates are conditional to avoid unnecessary writes
 * - Vote logic and moderation logic are intentionally coupled here to keep consistency
 *
 * Additional info for Frontend/Modification:
 * - Frontend should rely on returned `{ voteCount, status }` instead of inferring state
 * - UI can disable voting controls when status is not `pending`
 * - Thresholds for approval/disapproval can be easily adjusted in `determinePostStatus`
 * - Can be extended to support moderator overrides, quorum rules, or delayed approvals
 */

import pool from "../db.js";

const determinePostStatus = (voteCount) => {
  if (voteCount >= 1) return "approved";
  if (voteCount <= -1) return "disapproved";
  return "pending";
};

export const voteOnPost = async ({ userId, postId, vote }) => {

  try {
    await pool.query("BEGIN");

    const postRes = await pool.query('SELECT status FROM posts WHERE id = $1;',[postId]);

    if (postRes.rows[0].status != "pending"){
      throw new Error("Voting is closed for this post");
    }

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

    const { vote_count } = result.rows[0];

    const newStatus = determinePostStatus(vote_count);

    await pool.query(
      `
      UPDATE posts
      SET status = $1
      WHERE id = $2 AND status <> $1
      `,
      [newStatus, postId]
    );

    return { voteCount: vote_count, status: newStatus };

  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  } 
};
