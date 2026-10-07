import pool from "../db.js";
import { calculateNextReviewAt } from "./knowledge-review.services.js";

const VALID_STATUSES = new Set(["all", "active", "needs_update", "replaced"]);
const VALID_REVIEW_CATEGORIES = new Set(["stable", "yearly", "term", "frequent"]);

export const listKnowledgeForAdmin = async (
  { status = "all", search = "", limit = 50, offset = 0 } = {},
  database = pool,
) => {
  if (!VALID_STATUSES.has(status)) {
    const error = new Error("Invalid knowledge status");
    error.status = 400;
    throw error;
  }
  const safeSearch = String(search || "").trim().slice(0, 200);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const result = await database.query(
    `SELECT k.id, k.cleaned_content AS content, k.raw_content,
            k.status, k.review_category, k.last_verified_at, k.review_due_at,
            k.verification_requested_at, k.source_post_id, source.content AS source_content,
            source.type AS source_type, k.superseded_by_id,
            replacement.cleaned_content AS replacement_content,
            verification.status AS latest_verification_status,
            verification.resolved_at AS latest_verification_at,
            correction.status AS correction_status,
            correction.question_post_id AS correction_question_post_id,
            COUNT(*) OVER()::integer AS total_count
     FROM approved_knowledge k
     LEFT JOIN posts source ON source.id = k.source_post_id
     LEFT JOIN approved_knowledge replacement ON replacement.id = k.superseded_by_id
     LEFT JOIN LATERAL (
       SELECT status, resolved_at
       FROM knowledge_verifications
       WHERE knowledge_id = k.id
       ORDER BY opened_at DESC, id DESC
       LIMIT 1
     ) verification ON TRUE
     LEFT JOIN LATERAL (
       SELECT status, question_post_id
       FROM knowledge_correction_questions
       WHERE knowledge_id = k.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) correction ON TRUE
     WHERE ($1 = 'all' OR k.status = $1)
       AND (
         $2 = '' OR
         to_tsvector(
           'english',
           COALESCE(k.cleaned_content, '') || ' ' || COALESCE(k.raw_content, '')
         ) @@ websearch_to_tsquery('english', $2)
       )
     ORDER BY k.id DESC
     LIMIT $3 OFFSET $4`,
    [status, safeSearch, safeLimit, safeOffset],
  );
  return {
    items: result.rows.map(({ total_count, ...row }) => row),
    total: Number(result.rows[0]?.total_count || 0),
    limit: safeLimit,
    offset: safeOffset,
  };
};

export const updateKnowledgeReviewCategory = async (
  knowledgeId,
  reviewCategory,
  database = pool,
) => {
  const id = Number(knowledgeId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid knowledge ID");
    error.status = 400;
    throw error;
  }
  if (!VALID_REVIEW_CATEGORIES.has(reviewCategory)) {
    const error = new Error("Invalid review category");
    error.status = 400;
    throw error;
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT id, status, last_verified_at
       FROM approved_knowledge
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    if (current.rowCount !== 1) {
      const error = new Error("Knowledge fact not found");
      error.status = 404;
      throw error;
    }

    const fact = current.rows[0];
    const reviewDueAt = fact.status === "active"
      ? calculateNextReviewAt(reviewCategory, fact.last_verified_at)
      : null;
    const updated = await client.query(
      `UPDATE approved_knowledge
       SET review_category = $1, review_due_at = $2
       WHERE id = $3
       RETURNING id, review_category, review_due_at`,
      [reviewCategory, reviewDueAt, id],
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const queueKnowledgeReview = async (knowledgeId, database = pool) => {
  const id = Number(knowledgeId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid knowledge ID");
    error.status = 400;
    throw error;
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT k.id, k.status,
              EXISTS (
                SELECT 1 FROM knowledge_verifications v
                WHERE v.knowledge_id = k.id AND v.status = 'open'
              ) AS has_open_verification
       FROM approved_knowledge k
       WHERE k.id = $1
       FOR UPDATE OF k`,
      [id],
    );
    if (current.rowCount !== 1) {
      const error = new Error("Knowledge fact not found");
      error.status = 404;
      throw error;
    }
    if (current.rows[0].status !== "active") {
      const error = new Error("Only active knowledge can be reviewed");
      error.status = 409;
      throw error;
    }
    if (current.rows[0].has_open_verification) {
      await client.query("COMMIT");
      return { id, queued: false, alreadyOpen: true };
    }

    const queued = await client.query(
      `UPDATE approved_knowledge
       SET review_due_at = NOW(), verification_requested_at = NULL
       WHERE id = $1
       RETURNING id, review_due_at`,
      [id],
    );
    await client.query("COMMIT");
    return {
      id: queued.rows[0].id,
      reviewDueAt: queued.rows[0].review_due_at,
      queued: true,
      alreadyOpen: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
