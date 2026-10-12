import pool from "../db.js";
import { retrieveKnowledgeCandidates } from "./rag-retrieval.services.js";

export const OFFICIAL_RESOURCE_LIMIT = 3;
export const FACILITY_LIMIT = 3;

const rowsOrEmpty = async promise => {
  try {
    return await promise;
  } catch (error) {
    // These catalogs are optional while the manual Neon migration is pending.
    if (["42P01", "42703"].includes(error?.code)) return [];
    console.error("Unified evidence retrieval branch failed:", error.message);
    return [];
  }
};

export async function retrieveOfficialResourceCandidates(queryEmbedding, queryText, dependencies = {}) {
  const database = dependencies.database || pool;
  const limit = dependencies.limit || OFFICIAL_RESOURCE_LIMIT;
  const { rows } = await database.query(
    `WITH resource_text AS (
       SELECT r.id, r.slug, r.name, r.description, r.url, r.response_text,
              r.requires_login, r.last_verified_at, r.priority, r.embedding,
              COALESCE(string_agg(a.normalized_alias, ' '), '') AS aliases
       FROM official_resources r
       LEFT JOIN official_resource_aliases a ON a.resource_id = r.id
       WHERE r.active = TRUE
       GROUP BY r.id
     ), ranked AS (
       SELECT *,
              CASE WHEN embedding IS NULL THEN NULL ELSE 1 - (embedding <=> $1::vector) END AS similarity,
              ts_rank_cd(
                to_tsvector('english', name || ' ' || description || ' ' || aliases),
                websearch_to_tsquery('english', $2)
              ) AS text_score
       FROM resource_text
     )
     SELECT * FROM ranked
     WHERE similarity >= 0.35 OR text_score > 0
     ORDER BY (CASE WHEN text_score > 0 THEN 1 ELSE 0 END) DESC,
              text_score DESC, similarity DESC NULLS LAST, priority DESC
     LIMIT $3`,
    [JSON.stringify(queryEmbedding), String(queryText || ""), limit],
  );
  return rows.map(row => ({
    resourceId: Number(row.id), slug: row.slug, name: row.name,
    description: row.description, url: row.url, responseText: row.response_text,
    requiresLogin: Boolean(row.requires_login), lastVerifiedAt: row.last_verified_at,
    similarity: row.similarity == null ? null : Number(row.similarity),
  }));
}

export async function retrieveFacilityCandidates(queryEmbedding, queryText, dependencies = {}) {
  const database = dependencies.database || pool;
  const limit = dependencies.limit || FACILITY_LIMIT;
  const { rows } = await database.query(
    `WITH facility_text AS (
       SELECT f.id, f.name, f.description, f.embedding,
              COALESCE(string_agg(a.normalized_alias, ' '), '') AS aliases
       FROM facilities f
       LEFT JOIN facility_aliases a ON a.facility_id = f.id
       WHERE f.active = TRUE
       GROUP BY f.id
     ), ranked AS (
       SELECT *,
              CASE WHEN embedding IS NULL THEN NULL ELSE 1 - (embedding <=> $1::vector) END AS similarity,
              ts_rank_cd(
                to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || aliases),
                websearch_to_tsquery('english', $2)
              ) AS text_score
       FROM facility_text
     )
     SELECT * FROM ranked
     WHERE similarity >= 0.35 OR text_score > 0
     ORDER BY (CASE WHEN text_score > 0 THEN 1 ELSE 0 END) DESC,
              text_score DESC, similarity DESC NULLS LAST
     LIMIT $3`,
    [JSON.stringify(queryEmbedding), String(queryText || ""), limit],
  );
  return rows.map(row => ({
    facilityId: Number(row.id), facilityName: row.name, description: row.description || "",
    similarity: row.similarity == null ? null : Number(row.similarity),
  }));
}

export async function retrieveUnifiedEvidence(queryEmbedding, queryText, dependencies = {}) {
  const database = dependencies.database || pool;
  const [knowledge, officialResources, facilities] = await Promise.all([
    rowsOrEmpty(retrieveKnowledgeCandidates(queryEmbedding, queryText, { database })),
    rowsOrEmpty(retrieveOfficialResourceCandidates(queryEmbedding, queryText, { database })),
    rowsOrEmpty(retrieveFacilityCandidates(queryEmbedding, queryText, { database })),
  ]);
  return { knowledge, officialResources, facilities };
}

