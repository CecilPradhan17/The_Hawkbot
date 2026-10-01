import pool from "../db.js";
import { processApproval, processPostApproval } from "./approval.services.js";
import { resolveVerificationOutcome } from "./knowledge-review.services.js";
import 'dotenv/config';

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
const APPROVAL_THRESHOLD = process.env.VOTE_APPROVAL_THRESHOLD;
const DEFAULT_APPROVAL_THRESHOLD = 5;

export const resolveApprovalThreshold = (configuredThreshold = APPROVAL_THRESHOLD) => {
  const threshold = Number(configuredThreshold ?? DEFAULT_APPROVAL_THRESHOLD);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("VOTE_APPROVAL_THRESHOLD must be a positive number");
  }
  return threshold;
};

export const voteOnPost = async ({ userId, postId, vote }, dependencies = {}) => {
  const database = dependencies.database || pool;
  const postApproval = dependencies.postApproval || processPostApproval;
  const answerApproval = dependencies.answerApproval || processApproval;
  const verificationResolver = dependencies.verificationResolver || resolveVerificationOutcome;
  const threshold = resolveApprovalThreshold(dependencies.approvalThreshold);
  const client = await database.connect();
  try {
    await client.query("BEGIN");

    const postRes = await client.query(
      `SELECT id, type, parent_id, status
       FROM posts
       WHERE id = $1
       FOR UPDATE`,
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
    const existing = await client.query(
      `SELECT vote FROM post_votes
       WHERE user_id = $1 AND post_id = $2`,
      [userId, postId]
    );

    if (existing.rows.length === 0) {
      // First vote
      await client.query(
        `INSERT INTO post_votes (user_id, post_id, vote)
         VALUES ($1, $2, $3)`,
        [userId, postId, vote]
      );
      await client.query(
        `UPDATE posts
         SET vote_count = vote_count + $1
         WHERE id = $2`,
        [vote, postId]
      );
    } else {
      const prevVote = existing.rows[0].vote;

      if (prevVote === vote) {
        // Toggle off
        await client.query(
          `DELETE FROM post_votes
           WHERE user_id = $1 AND post_id = $2`,
          [userId, postId]
        );
        await client.query(
          `UPDATE posts
           SET vote_count = vote_count - $1
           WHERE id = $2`,
          [vote, postId]
        );
      } else {
        // Switch vote
        await client.query(
          `UPDATE post_votes
           SET vote = $1
           WHERE user_id = $2 AND post_id = $3`,
          [vote, userId, postId]
        );
        await client.query(
          `UPDATE posts
           SET vote_count = vote_count + $1
           WHERE id = $2`,
          [vote * 2, postId]
        );
      }
    }

    // Get updated vote count
    const updated = await client.query(
      `SELECT vote_count FROM posts WHERE id = $1`,
      [postId]
    );

    const voteCount = updated.rows[0].vote_count;
    const newStatus = voteCount >= threshold
      ? "approved"
      : voteCount <= -threshold ? "disapproved" : "pending";

    // Update this answer's status
    await client.query(
      `UPDATE posts
       SET status = $1
       WHERE id = $2`,
      [newStatus, postId]
    );

    if (type === "verification" && newStatus !== "pending") {
      await verificationResolver(client, postId, newStatus);
      await client.query("COMMIT");
      return { voteCount, status: newStatus };
    }

    if (type === "post" && newStatus === "approved") {
      await client.query("COMMIT");

      Promise.resolve(postApproval(postId)).catch((err) =>
        console.error("processPostApproval error:", err)
      );

      return { voteCount, status: newStatus };
    }

    if (type === "answer" && newStatus === "approved") {
      await client.query(
        `UPDATE posts
         SET status = 'approved'
         WHERE id = $1 AND type = 'question'`,
        [parent_id]
      );

      // Disapprove all sibling answers
      await client.query(
        `UPDATE posts
         SET status = 'disapproved'
         WHERE parent_id = $1
         AND id <> $2
         AND type = 'answer'`,
        [parent_id, postId]
      );

      // Commit before triggering approval pipeline
      // so the DB state is clean if approval takes time
      await client.query("COMMIT");

      // Fire-and-forget: does not block the vote response
      Promise.resolve(answerApproval(postId, parent_id)).catch((err) =>
        console.error("processApproval error:", err)
      );

      return { voteCount, status: newStatus };
    }

    await client.query("COMMIT");

    return { voteCount, status: newStatus };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
