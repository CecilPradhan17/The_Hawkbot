import pool from "../db.js";
import "dotenv/config";

const configuredThreshold = () => {
  const threshold = Number(process.env.VOTE_APPROVAL_THRESHOLD);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("VOTE_APPROVAL_THRESHOLD must be a positive number");
  }
  return threshold;
};

export const reportKnowledgeOutdated = async (
  { userId, knowledgeIds },
  { database = pool, threshold = configuredThreshold() } = {},
) => {
  const numericThreshold = Number(threshold);
  if (!Number.isFinite(numericThreshold) || numericThreshold <= 0) {
    throw new Error("The outdated-report threshold must be a positive number");
  }
  const ids = [...new Set(knowledgeIds.map(Number))]
    .filter(id => Number.isInteger(id) && id > 0);
  if (ids.length === 0 || ids.length > 10) {
    const error = new Error("Between 1 and 10 knowledge IDs are required");
    error.status = 400;
    throw error;
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const facts = await client.query(
      `SELECT id FROM approved_knowledge
       WHERE id = ANY($1::int[]) AND status = 'active'
       ORDER BY id
       FOR UPDATE`,
      [ids],
    );
    if (facts.rowCount !== ids.length) {
      const error = new Error("One or more knowledge facts are unavailable");
      error.status = 404;
      throw error;
    }

    let added = false;
    let queued = false;
    for (const { id } of facts.rows) {
      const inserted = await client.query(
        `INSERT INTO knowledge_outdated_reports (knowledge_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (knowledge_id, user_id) WHERE resolved_at IS NULL DO NOTHING
         RETURNING id`,
        [id, userId],
      );
      added ||= inserted.rowCount === 1;

      const count = await client.query(
        `SELECT COUNT(*)::integer AS count
         FROM knowledge_outdated_reports
         WHERE knowledge_id = $1 AND resolved_at IS NULL`,
        [id],
      );
      if (Number(count.rows[0].count) >= numericThreshold) {
        await client.query(
          `UPDATE approved_knowledge
           SET review_due_at = LEAST(COALESCE(review_due_at, NOW()), NOW())
           WHERE id = $1 AND verification_requested_at IS NULL`,
          [id],
        );
        queued = true;
      }
    }

    await client.query("COMMIT");
    return { reported: added, queued };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
