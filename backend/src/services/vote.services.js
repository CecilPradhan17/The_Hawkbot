import pool from "../db.js";
import { processApproval } from "./approval.services.js";

/**
 * PURPOSE:
 * Handles voting for answers.
 * - Questions cannot be voted on.
 * - Answers can be voted on.
 * - If an answer reaches approval threshold:
 *      → It becomes approved
 *      → Its parent question becomes approved
 *      → All sibling answers become disapproved
 *      → processApproval() is triggered to store in approved_knowledge
 *
 * USED BY:
 * vote.controller.js → handleVote
 */
const APPROVAL_THRESHOLD = 5;

const determinePostStatus = (voteCount) => {
  if (voteCount >= APPROVAL_THRESHOLD) return "approved";
  if (voteCount <= -APPROVAL_THRESHOLD) return "disapproved";
  return "pending";
};

export const voteOnPost = async ({ userId, postId, vote }) => {
  try {
    await pool.query("BEGIN");

    const postRes = await pool.query(
      `SELECT id, type, parent_id, status
       FROM posts
       WHERE id = $1`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      throw new Error("Post not found");
    }

    const { type, parent_id, status } = postRes.rows[0];

    if (type === "question") {
      throw new Error("Questions cannot be voted on");
    }

    if (status !== "pending") {
      throw new Error("Voting is closed for this post");
    }

    // Check existing vote
    const existing = await pool.query(
      `SELECT vote FROM post_votes
       WHERE user_id = $1 AND post_id = $2`,
      [userId, postId]
    );

    if (existing.rows.length === 0) {
      // First vote
      await pool.query(
        `INSERT INTO post_votes (user_id, post_id, vote)
         VALUES ($1, $2, $3)`,
        [userId, postId, vote]
      );
      await pool.query(
        `UPDATE posts
         SET vote_count = vote_count + $1
         WHERE id = $2`,
        [vote, postId]
      );
    } else {
      const prevVote = existing.rows[0].vote;

      if (prevVote === vote) {
        // Toggle off
        await pool.query(
          `DELETE FROM post_votes
           WHERE user_id = $1 AND post_id = $2`,
          [userId, postId]
        );
        await pool.query(
          `UPDATE posts
           SET vote_count = vote_count - $1
           WHERE id = $2`,
          [vote, postId]
        );
      } else {
        // Switch vote
        await pool.query(
          `UPDATE post_votes
           SET vote = $1
           WHERE user_id = $2 AND post_id = $3`,
          [vote, userId, postId]
        );
        await pool.query(
          `UPDATE posts
           SET vote_count = vote_count + $1
           WHERE id = $2`,
          [vote * 2, postId]
        );
      }
    }

    // Get updated vote count
    const updated = await pool.query(
      `SELECT vote_count FROM posts WHERE id = $1`,
      [postId]
    );

    const voteCount = updated.rows[0].vote_count;
    const newStatus = determinePostStatus(voteCount);

    // Update this answer's status
    await pool.query(
      `UPDATE posts
       SET status = $1
       WHERE id = $2`,
      [newStatus, postId]
    );

    if (type === "answer" && newStatus === "approved") {
      await pool.query(
        `UPDATE posts
         SET status = 'approved'
         WHERE id = $1 AND type = 'question'`,
        [parent_id]
      );

      // Disapprove all sibling answers
      await pool.query(
        `UPDATE posts
         SET status = 'disapproved'
         WHERE parent_id = $1
         AND id <> $2
         AND type = 'answer'`,
        [parent_id, postId]
      );

      // Commit before triggering approval pipeline
      // so the DB state is clean if approval takes time
      await pool.query("COMMIT");

      // Fire-and-forget: does not block the vote response
      processApproval(postId, parent_id).catch((err) =>
        console.error("processApproval error:", err)
      );

      return { voteCount, status: newStatus };
    }

    await pool.query("COMMIT");

    return { voteCount, status: newStatus };
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
};