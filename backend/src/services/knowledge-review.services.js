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
