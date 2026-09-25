import pool from "../db.js";

export const RAG_CANDIDATE_LIMIT = 10;
export const RAG_SOURCE_POOL_LIMIT = 20;
export const RAG_SIMILARITY_THRESHOLD = 0.50;

export const isConfidentCandidate = candidate =>
  Number(candidate?.similarity) >= RAG_SIMILARITY_THRESHOLD
  || candidate?.text_rank !== null && candidate?.text_rank !== undefined;

/**
 * Uses an exact cosine-distance scan while Hawkbot's knowledge base is small.
 * Adding zero to the distance expression intentionally prevents PostgreSQL
 * from satisfying ORDER BY with the approximate IVFFlat index.
 */
export async function retrieveKnowledgeCandidates(queryEmbedding, queryText, dependencies = {}) {
  const database = dependencies.database || pool;
  const limit = dependencies.limit || RAG_CANDIDATE_LIMIT;
  const sourceLimit = dependencies.sourceLimit || RAG_SOURCE_POOL_LIMIT;
  const result = await database.query(
    `WITH text_query AS (
       SELECT websearch_to_tsquery('english', $2) AS query
     ),
     vector_ranked AS MATERIALIZED (
       SELECT id,
              ROW_NUMBER() OVER (ORDER BY (embedding <=> $1::vector) + 0) AS vector_rank
       FROM approved_knowledge
       WHERE embedding IS NOT NULL
       ORDER BY (embedding <=> $1::vector) + 0
       LIMIT $3
     ),
     text_ranked AS MATERIALIZED (
       SELECT k.id,
              ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(
                  to_tsvector('english', COALESCE(k.cleaned_content, '') || ' ' || COALESCE(k.raw_content, '')),
                  q.query
                ) DESC
              ) AS text_rank
       FROM approved_knowledge k
       CROSS JOIN text_query q
       WHERE to_tsvector('english', COALESCE(k.cleaned_content, '') || ' ' || COALESCE(k.raw_content, '')) @@ q.query
       ORDER BY ts_rank_cd(
         to_tsvector('english', COALESCE(k.cleaned_content, '') || ' ' || COALESCE(k.raw_content, '')),
         q.query
       ) DESC
       LIMIT $3
     ),
     fused AS (
       SELECT COALESCE(v.id, t.id) AS id,
              v.vector_rank,
              t.text_rank,
              COALESCE(1.0 / (60 + v.vector_rank), 0)
                + COALESCE(1.0 / (60 + t.text_rank), 0) AS retrieval_score
       FROM vector_ranked v
       FULL OUTER JOIN text_ranked t ON t.id = v.id
     )
     SELECT k.id, k.source_post_id, k.cleaned_content, k.raw_content, k.approved_at,
            CASE WHEN k.embedding IS NULL THEN NULL
                 ELSE 1 - (k.embedding <=> $1::vector)
            END AS similarity,
            fused.vector_rank, fused.text_rank, fused.retrieval_score
     FROM fused
     JOIN approved_knowledge k ON k.id = fused.id
     ORDER BY fused.retrieval_score DESC,
              CASE WHEN k.embedding IS NULL THEN NULL ELSE k.embedding <=> $1::vector END
     LIMIT $4`,
    [JSON.stringify(queryEmbedding), String(queryText || ""), sourceLimit, limit]
  );
  return result.rows;
}
