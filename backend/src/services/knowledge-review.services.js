import { DateTime } from "luxon";
import pool from "../db.js";

export const CAMPUS_TIME_ZONE = "America/Chicago";
export const DAILY_VERIFICATION_LIMIT = 5;
export const VERIFICATION_ATTEMPT_DAYS = 7;
export const FREQUENT_REVIEW_DAYS = 90;
export const TERM_MINIMUM_GAP_DAYS = 30;

const asCampusDateTime = value => {
  if (DateTime.isDateTime(value)) return value.setZone(CAMPUS_TIME_ZONE);
  if (value instanceof Date) return DateTime.fromJSDate(value, { zone: CAMPUS_TIME_ZONE });
  return DateTime.fromISO(String(value), { zone: CAMPUS_TIME_ZONE });
};

export const calculateNextReviewAt = (reviewCategory, lastVerifiedAt) => {
  const verified = asCampusDateTime(lastVerifiedAt);
  if (!verified.isValid) throw new Error("A valid last verification date is required");

  if (reviewCategory === "stable") return null;
  if (reviewCategory === "yearly") return verified.plus({ years: 1 }).toUTC().toISO();
  if (reviewCategory === "frequent") return verified.plus({ days: FREQUENT_REVIEW_DAYS }).toUTC().toISO();
  if (reviewCategory !== "term") throw new Error("Unsupported review category");

  for (let year = verified.year; year <= verified.year + 2; year += 1) {
    for (const month of [1, 8]) {
      const boundary = DateTime.fromObject(
        { year, month, day: 1, hour: 0 },
        { zone: CAMPUS_TIME_ZONE },
      );
      if (boundary > verified && boundary.diff(verified, "days").days >= TERM_MINIMUM_GAP_DAYS) {
        return boundary.toUTC().toISO();
      }
    }
  }
  throw new Error("Could not calculate the next term review");
};

export const buildVerificationPostContent = fact =>
  `Hawkbot currently knows:\n“${String(fact).trim()}”\n\nIs this still accurate?`;

export const resolveVerificationOutcome = async (
  client,
  postId,
  postStatus,
  resolvedAt = new Date(),
) => {
  if (!["approved", "disapproved"].includes(postStatus)) return false;
  const result = await client.query(
    `SELECT v.id, v.knowledge_id, k.review_category
     FROM knowledge_verifications v
     JOIN approved_knowledge k ON k.id = v.knowledge_id
     WHERE v.post_id = $1 AND v.status = 'open'
     FOR UPDATE OF v, k`,
    [postId]
  );
  if (result.rowCount !== 1) throw new Error("Open verification not found");
  const verification = result.rows[0];

  if (postStatus === "approved") {
    const reviewDueAt = calculateNextReviewAt(verification.review_category, resolvedAt);
    await client.query(
      `UPDATE knowledge_verifications
       SET status = 'reconfirmed', resolved_at = $1
       WHERE id = $2`,
      [resolvedAt, verification.id]
    );
    await client.query(
      `UPDATE approved_knowledge
       SET status = 'active', last_verified_at = $1, review_due_at = $2,
           verification_requested_at = NULL
       WHERE id = $3`,
      [resolvedAt, reviewDueAt, verification.knowledge_id]
    );
  } else {
    await client.query(
      `UPDATE knowledge_verifications
       SET status = 'rejected', resolved_at = $1
       WHERE id = $2`,
      [resolvedAt, verification.id]
    );
    await client.query(
      `UPDATE approved_knowledge
       SET status = 'needs_update', review_due_at = NULL,
           verification_requested_at = NULL
       WHERE id = $1`,
      [verification.knowledge_id]
    );
  }
  await client.query(
    `UPDATE knowledge_outdated_reports SET resolved_at = $1
     WHERE knowledge_id = $2 AND resolved_at IS NULL`,
    [resolvedAt, verification.knowledge_id],
  );
  return true;
};

export const createDueVerificationPosts = async ({
  database = pool,
  now = DateTime.now().setZone(CAMPUS_TIME_ZONE),
  limit = DAILY_VERIFICATION_LIMIT,
} = {}) => {
  const runAt = asCampusDateTime(now);
  if (!runAt.isValid) throw new Error("A valid scheduler time is required");
  const safeLimit = Math.min(Math.max(Number(limit) || 0, 0), DAILY_VERIFICATION_LIMIT);
  if (safeLimit === 0) return [];

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    // Serializes scheduler retries or overlapping workers for the daily cap.
    await client.query("SELECT pg_advisory_xact_lock(4815162342)");
    const systemUser = await client.query(
      "SELECT id FROM users WHERE is_system = TRUE LIMIT 1"
    );
    if (systemUser.rowCount !== 1) throw new Error("Hawkbot system account is missing");

    const campusDayStart = runAt.startOf("day");
    const campusDayEnd = campusDayStart.plus({ days: 1 });
    const dailyCount = await client.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_verifications
       WHERE opened_at >= $1 AND opened_at < $2`,
      [campusDayStart.toUTC().toJSDate(), campusDayEnd.toUTC().toJSDate()]
    );
    const remainingToday = Math.max(
      DAILY_VERIFICATION_LIMIT - Number(dailyCount.rows[0]?.count || 0),
      0,
    );
    const availableLimit = Math.min(safeLimit, remainingToday);
    if (availableLimit === 0) {
      await client.query("COMMIT");
      return [];
    }

    const due = await client.query(
      `SELECT k.id, k.cleaned_content
       FROM approved_knowledge k
       WHERE k.status = 'active'
         AND k.review_due_at IS NOT NULL
         AND k.review_due_at <= $1
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_verifications v
           WHERE v.knowledge_id = k.id AND v.status = 'open'
         )
       ORDER BY k.review_due_at ASC, k.id ASC
       FOR UPDATE OF k SKIP LOCKED
       LIMIT $2`,
      [runAt.toUTC().toJSDate(), availableLimit]
    );

    const created = [];
    for (const fact of due.rows) {
      const post = await client.query(
        `INSERT INTO posts (content, author_id, type, parent_id)
         VALUES ($1, $2, 'verification', NULL)
         RETURNING id, content, created_at`,
        [buildVerificationPostContent(fact.cleaned_content), systemUser.rows[0].id]
      );
      const openedAt = runAt.toUTC();
      const closesAt = openedAt.plus({ days: VERIFICATION_ATTEMPT_DAYS });
      await client.query(
        `INSERT INTO knowledge_verifications
           (knowledge_id, post_id, cycle_started_at, attempt_number, status, opened_at, closes_at)
         VALUES ($1, $2, $3, 1, 'open', $3, $4)`,
        [fact.id, post.rows[0].id, openedAt.toJSDate(), closesAt.toJSDate()]
      );
      await client.query(
        "UPDATE approved_knowledge SET verification_requested_at = $1 WHERE id = $2",
        [openedAt.toJSDate(), fact.id]
      );
      created.push({ knowledgeId: fact.id, post: post.rows[0] });
    }

    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const resolveExpiredVerifications = async ({
  database = pool,
  now = DateTime.now().setZone(CAMPUS_TIME_ZONE),
} = {}) => {
  const runAt = asCampusDateTime(now);
  if (!runAt.isValid) throw new Error("A valid scheduler time is required");
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(4815162342)");
    const systemUser = await client.query(
      "SELECT id FROM users WHERE is_system = TRUE LIMIT 1"
    );
    if (systemUser.rowCount !== 1) throw new Error("Hawkbot system account is missing");

    const dayStart = runAt.startOf("day");
    const dayEnd = dayStart.plus({ days: 1 });
    const count = await client.query(
      `SELECT COUNT(*)::integer AS count FROM knowledge_verifications
       WHERE opened_at >= $1 AND opened_at < $2`,
      [dayStart.toUTC().toJSDate(), dayEnd.toUTC().toJSDate()]
    );
    let retryCapacity = Math.max(DAILY_VERIFICATION_LIMIT - Number(count.rows[0]?.count || 0), 0);
    const expired = await client.query(
      `SELECT v.id, v.knowledge_id, v.post_id, v.cycle_started_at,
              v.attempt_number, k.cleaned_content, k.review_category
       FROM knowledge_verifications v
       JOIN approved_knowledge k ON k.id = v.knowledge_id
       WHERE v.status = 'open' AND v.closes_at <= $1
       ORDER BY v.closes_at ASC, v.id ASC
       FOR UPDATE OF v, k SKIP LOCKED`,
      [runAt.toUTC().toJSDate()]
    );

    const results = [];
    for (const verification of expired.rows) {
      if (verification.attempt_number === 1 && retryCapacity === 0) continue;
      const terminal = verification.attempt_number === 2;
      await client.query(
        `UPDATE knowledge_verifications
         SET status = $1, resolved_at = $2
         WHERE id = $3`,
        [terminal ? "exhausted" : "unresolved", runAt.toUTC().toJSDate(), verification.id]
      );
      await client.query("UPDATE posts SET status = 'closed' WHERE id = $1", [verification.post_id]);

      if (terminal) {
        const nextReview = calculateNextReviewAt(verification.review_category, runAt);
        await client.query(
          `UPDATE approved_knowledge
           SET verification_requested_at = NULL, review_due_at = $1
           WHERE id = $2`,
          [nextReview, verification.knowledge_id]
        );
        await client.query(
          `UPDATE knowledge_outdated_reports SET resolved_at = $1
           WHERE knowledge_id = $2 AND resolved_at IS NULL`,
          [runAt.toUTC().toJSDate(), verification.knowledge_id],
        );
        results.push({ knowledgeId: verification.knowledge_id, status: "exhausted" });
        continue;
      }

      const post = await client.query(
        `INSERT INTO posts (content, author_id, type, parent_id)
         VALUES ($1, $2, 'verification', NULL)
         RETURNING id`,
        [buildVerificationPostContent(verification.cleaned_content), systemUser.rows[0].id]
      );
      const openedAt = runAt.toUTC();
      await client.query(
        `INSERT INTO knowledge_verifications
           (knowledge_id, post_id, cycle_started_at, attempt_number, status, opened_at, closes_at)
         VALUES ($1, $2, $3, 2, 'open', $4, $5)`,
        [verification.knowledge_id, post.rows[0].id, verification.cycle_started_at,
          openedAt.toJSDate(), openedAt.plus({ days: VERIFICATION_ATTEMPT_DAYS }).toJSDate()]
      );
      await client.query(
        "UPDATE approved_knowledge SET verification_requested_at = $1 WHERE id = $2",
        [openedAt.toJSDate(), verification.knowledge_id]
      );
      retryCapacity -= 1;
      results.push({ knowledgeId: verification.knowledge_id, status: "retried" });
    }

    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const runKnowledgeReview = async ({
  database = pool,
  now = DateTime.now().setZone(CAMPUS_TIME_ZONE),
  expiredResolver = resolveExpiredVerifications,
  duePostCreator = createDueVerificationPosts,
} = {}) => {
  const resolved = await expiredResolver({ database, now });
  const created = await duePostCreator({ database, now });
  return { resolved, created };
};
