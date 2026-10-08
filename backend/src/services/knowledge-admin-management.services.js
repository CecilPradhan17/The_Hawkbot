import pool from "../db.js";
import { generateDocumentEmbedding } from "./embedding.services.js";
import { storeApprovedKnowledge } from "./approved-knowledge.services.js";

const REVIEW_CATEGORIES = new Set(["stable", "yearly", "term", "frequent"]);

const requestError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const closePosts = async (client, rows, key) => {
  const postIds = rows.map(row => row[key]).filter(Boolean);
  if (postIds.length > 0) {
    await client.query(
      "UPDATE posts SET status = 'closed' WHERE id = ANY($1::int[])",
      [postIds],
    );
  }
};

export const correctKnowledgeForAdmin = async (
  { knowledgeId, adminUserId, content, reviewCategory, note },
  dependencies = {},
) => {
  const id = Number(knowledgeId);
  const adminId = Number(adminUserId);
  const correctedContent = String(content || "").trim().replace(/\s+/g, " ");
  const correctionNote = String(note || "").trim();

  if (!Number.isInteger(id) || id <= 0) throw requestError("Invalid knowledge ID");
  if (!Number.isInteger(adminId) || adminId <= 0) throw requestError("Invalid administrator ID");
  if (correctedContent.length < 5 || correctedContent.length > 2000) {
    throw requestError("Corrected knowledge must be between 5 and 2000 characters");
  }
  if (!REVIEW_CATEGORIES.has(reviewCategory)) throw requestError("Invalid review category");
  if (correctionNote.length < 3 || correctionNote.length > 1000) {
    throw requestError("Correction note must be between 3 and 1000 characters");
  }

  const database = dependencies.database || pool;
  const embeddingGenerator = dependencies.embeddingGenerator || generateDocumentEmbedding;
  const storage = dependencies.storage || storeApprovedKnowledge;

  const stored = await storage({
    db: database,
    sourcePostId: null,
    rawContent: null,
    chunks: [{ content: correctedContent, reviewCategory }],
    generateEmbedding: embeddingGenerator,
    afterStore: async ({ client, stored: inserted, verifiedAt }) => {
      const current = await client.query(
        `SELECT id, status
         FROM approved_knowledge
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      if (current.rowCount !== 1) throw requestError("Knowledge fact not found", 404);
      if (!new Set(["active", "needs_update"]).has(current.rows[0].status)) {
        throw requestError("Only active or needs-update knowledge can be corrected", 409);
      }

      const replacementKnowledgeId = inserted[0].id;
      await client.query(
        `UPDATE approved_knowledge
         SET status = 'replaced', superseded_by_id = $1,
             review_due_at = NULL, verification_requested_at = NULL
         WHERE id = $2`,
        [replacementKnowledgeId, id],
      );

      const verifications = await client.query(
        `UPDATE knowledge_verifications
         SET status = 'cancelled', resolved_at = $1
         WHERE knowledge_id = $2 AND status = 'open'
         RETURNING post_id`,
        [verifiedAt, id],
      );
      await closePosts(client, verifications.rows, "post_id");

      const corrections = await client.query(
        `UPDATE knowledge_correction_questions
         SET status = 'resolved', replacement_knowledge_id = $1, resolved_at = $2
         WHERE knowledge_id = $3 AND status = 'open'
         RETURNING question_post_id`,
        [replacementKnowledgeId, verifiedAt, id],
      );
      await closePosts(client, corrections.rows, "question_post_id");

      await client.query(
        `UPDATE knowledge_outdated_reports
         SET resolved_at = $1
         WHERE knowledge_id = $2 AND resolved_at IS NULL`,
        [verifiedAt, id],
      );
      await client.query(
        `INSERT INTO knowledge_admin_actions
           (knowledge_id, replacement_knowledge_id, admin_user_id, action, note, created_at)
         VALUES ($1, $2, $3, 'corrected', $4, $5)`,
        [id, replacementKnowledgeId, adminId, correctionNote, verifiedAt],
      );
    },
  });

  return {
    replacedKnowledgeId: id,
    replacement: stored[0],
  };
};

export const archiveKnowledgeForAdmin = async (
  { knowledgeId, adminUserId, note },
  dependencies = {},
) => {
  const id = Number(knowledgeId);
  const adminId = Number(adminUserId);
  const archiveNote = String(note || "").trim();
  if (!Number.isInteger(id) || id <= 0) throw requestError("Invalid knowledge ID");
  if (!Number.isInteger(adminId) || adminId <= 0) throw requestError("Invalid administrator ID");
  if (archiveNote.length < 3 || archiveNote.length > 1000) {
    throw requestError("Archive note must be between 3 and 1000 characters");
  }

  const database = dependencies.database || pool;
  const archivedAt = dependencies.now || new Date();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT id, status
       FROM approved_knowledge
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    if (current.rowCount !== 1) throw requestError("Knowledge fact not found", 404);
    if (!new Set(["active", "needs_update"]).has(current.rows[0].status)) {
      throw requestError("Only active or needs-update knowledge can be archived", 409);
    }

    await client.query(
      `UPDATE approved_knowledge
       SET status = 'archived', review_due_at = NULL,
           verification_requested_at = NULL
       WHERE id = $1`,
      [id],
    );
    const verifications = await client.query(
      `UPDATE knowledge_verifications
       SET status = 'cancelled', resolved_at = $1
       WHERE knowledge_id = $2 AND status = 'open'
       RETURNING post_id`,
      [archivedAt, id],
    );
    await closePosts(client, verifications.rows, "post_id");
    const corrections = await client.query(
      `UPDATE knowledge_correction_questions
       SET status = 'cancelled', resolved_at = $1
       WHERE knowledge_id = $2 AND status = 'open'
       RETURNING question_post_id`,
      [archivedAt, id],
    );
    await closePosts(client, corrections.rows, "question_post_id");
    await client.query(
      `UPDATE knowledge_outdated_reports
       SET resolved_at = $1
       WHERE knowledge_id = $2 AND resolved_at IS NULL`,
      [archivedAt, id],
    );
    await client.query(
      `INSERT INTO knowledge_admin_actions
         (knowledge_id, replacement_knowledge_id, admin_user_id, action, note, created_at)
       VALUES ($1, NULL, $2, 'archived', $3, $4)`,
      [id, adminId, archiveNote, archivedAt],
    );
    await client.query("COMMIT");
    return { id, status: "archived", archivedAt };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
