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
export const VOTE_THRESHOLD_GRACE_MS = 15 * 60 * 1000;

export const resolveApprovalThreshold = (configuredThreshold = APPROVAL_THRESHOLD) => {
  const threshold = Number(configuredThreshold ?? DEFAULT_APPROVAL_THRESHOLD);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("VOTE_APPROVAL_THRESHOLD must be a positive number");
  }
  return threshold;
};

export const resolveThresholdTracking = ({
  voteCount,
  threshold,
  crossedAt,
  direction,
  now = new Date(),
}) => {
  const nextDirection = voteCount >= threshold ? 1 : voteCount <= -threshold ? -1 : null;
  if (nextDirection === null) return { crossedAt: null, direction: null };
  if (Number(direction) === nextDirection && crossedAt) {
    return { crossedAt, direction: nextDirection };
  }
  return { crossedAt: now, direction: nextDirection };
};

const isGracePeriodComplete = (post, threshold, now, graceMs) => {
  if (!post.threshold_crossed_at || !post.threshold_direction) return false;
  const direction = Number(post.threshold_direction);
  const stillCrossed = direction === 1
    ? Number(post.vote_count) >= threshold
    : Number(post.vote_count) <= -threshold;
  return stillCrossed
    && now.getTime() - new Date(post.threshold_crossed_at).getTime() >= graceMs;
};

const finalizeLockedPost = async ({ client, post, status, verificationResolver, now }) => {
  await client.query(
    `UPDATE posts
     SET status = $1, threshold_crossed_at = NULL, threshold_direction = NULL
     WHERE id = $2`,
    [status, post.id]
  );

  if (post.type === "verification") {
    await verificationResolver(client, post.id, status, now);
  } else if (post.type === "answer" && status === "approved") {
    await client.query(
      `UPDATE posts SET status = 'approved'
       WHERE id = $1 AND type = 'question'`,
      [post.parent_id]
    );
    await client.query(
      `UPDATE posts
       SET status = 'disapproved', threshold_crossed_at = NULL, threshold_direction = NULL
       WHERE parent_id = $1 AND id <> $2 AND type = 'answer'`,
      [post.parent_id, post.id]
    );
  }
};

const triggerApprovalPipeline = (post, status, postApproval, answerApproval) => {
  if (status !== "approved") return;
  if (post.type === "post") {
    Promise.resolve(postApproval(post.id)).catch(err =>
      console.error("processPostApproval error:", err)
    );
  } else if (post.type === "answer") {
    Promise.resolve(answerApproval(post.id, post.parent_id)).catch(err =>
      console.error("processApproval error:", err)
    );
  }
};

export const voteOnPost = async ({ userId, postId, vote }, dependencies = {}) => {
  const database = dependencies.database || pool;
  const postApproval = dependencies.postApproval || processPostApproval;
  const answerApproval = dependencies.answerApproval || processApproval;
  const verificationResolver = dependencies.verificationResolver || resolveVerificationOutcome;
  const threshold = resolveApprovalThreshold(dependencies.approvalThreshold);
  const now = dependencies.now || new Date();
  const graceMs = dependencies.graceMs ?? VOTE_THRESHOLD_GRACE_MS;
  const client = await database.connect();
  try {
    await client.query("BEGIN");

    const postRes = await client.query(
      `SELECT id, type, parent_id, status, vote_count,
              threshold_crossed_at, threshold_direction
       FROM posts
       WHERE id = $1
       FOR UPDATE`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      throw new Error("Post not found");
    }

    const { type, parent_id, status } = postRes.rows[0];
    const lockedPost = postRes.rows[0];

    if (type === "question") {
      throw new Error("Questions cannot be voted on");
    }

    if (status !== "pending") {
      const currentVote = await client.query(
        `SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2`,
        [userId, postId]
      );
      await client.query("COMMIT");
      return {
        voteCount: Number(lockedPost.vote_count),
        status,
        userVote: currentVote.rows[0]?.vote ?? null,
        accepted: false,
      };
    }

    if (isGracePeriodComplete(lockedPost, threshold, now, graceMs)) {
      const finalStatus = Number(lockedPost.threshold_direction) === 1 ? "approved" : "disapproved";
      await finalizeLockedPost({
        client,
        post: lockedPost,
        status: finalStatus,
        verificationResolver,
        now,
      });
      const currentVote = await client.query(
        `SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2`,
        [userId, postId]
      );
      await client.query("COMMIT");
      triggerApprovalPipeline(lockedPost, finalStatus, postApproval, answerApproval);
      return {
        voteCount: Number(lockedPost.vote_count),
        status: finalStatus,
        userVote: currentVote.rows[0]?.vote ?? null,
        accepted: false,
      };
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
      `SELECT vote_count, threshold_crossed_at, threshold_direction
       FROM posts WHERE id = $1`,
      [postId]
    );

    const voteCount = Number(updated.rows[0].vote_count);
    const tracking = resolveThresholdTracking({
      voteCount,
      threshold,
      crossedAt: updated.rows[0].threshold_crossed_at,
      direction: updated.rows[0].threshold_direction,
      now,
    });
    await client.query(
      `UPDATE posts
       SET threshold_crossed_at = $1, threshold_direction = $2
       WHERE id = $3`,
      [tracking.crossedAt, tracking.direction, postId]
    );

    await client.query("COMMIT");
    const userVote = existing.rows.length === 0
      ? vote
      : existing.rows[0].vote === vote ? null : vote;
    return { voteCount, status: "pending", userVote, accepted: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const finalizeDueVotes = async (dependencies = {}) => {
  const database = dependencies.database || pool;
  const postApproval = dependencies.postApproval || processPostApproval;
  const answerApproval = dependencies.answerApproval || processApproval;
  const verificationResolver = dependencies.verificationResolver || resolveVerificationOutcome;
  const threshold = resolveApprovalThreshold(dependencies.approvalThreshold);
  const now = dependencies.now || new Date();
  const graceMs = dependencies.graceMs ?? VOTE_THRESHOLD_GRACE_MS;
  const dueBefore = new Date(now.getTime() - graceMs);
  const due = await database.query(
    `SELECT id FROM posts
     WHERE status = 'pending' AND threshold_crossed_at <= $1
     ORDER BY threshold_crossed_at ASC
     LIMIT 100`,
    [dueBefore]
  );
  const finalized = [];

  for (const { id } of due.rows) {
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, type, parent_id, status, vote_count,
                threshold_crossed_at, threshold_direction
         FROM posts WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const post = result.rows[0];
      if (!post || post.status !== "pending" || !isGracePeriodComplete(post, threshold, now, graceMs)) {
        await client.query("COMMIT");
        continue;
      }
      const status = Number(post.threshold_direction) === 1 ? "approved" : "disapproved";
      await finalizeLockedPost({ client, post, status, verificationResolver, now });
      await client.query("COMMIT");
      triggerApprovalPipeline(post, status, postApproval, answerApproval);
      finalized.push({ id: post.id, status });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return finalized;
};
