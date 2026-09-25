import pool from "../db.js";

export const RAG_CANDIDATE_LIMIT = 10;

/**
 * Uses an exact cosine-distance scan while Hawkbot's knowledge base is small.
 * Adding zero to the distance expression intentionally prevents PostgreSQL
 * from satisfying ORDER BY with the approximate IVFFlat index.
 */
export async function retrieveKnowledgeCandidates(queryEmbedding, dependencies = {}) {
  const database = dependencies.database || pool;
  const limit = dependencies.limit || RAG_CANDIDATE_LIMIT;
  const result = await database.query(
    `SELECT id, source_post_id, cleaned_content, raw_content, approved_at,
            1 - (embedding <=> $1::vector) AS similarity
     FROM approved_knowledge
     WHERE embedding IS NOT NULL
     ORDER BY (embedding <=> $1::vector) + 0
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), limit]
  );
  return result.rows;
}
