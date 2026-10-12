import pool from "../db.js";
import {
  buildFacilityEmbeddingText,
  buildOfficialResourceEmbeddingText,
} from "./evidence-embedding.services.js";

const updateEmbedding = async (database, embed, { table, id, text }) => {
  const embedding = await embed(text);
  await database.query(`UPDATE ${table} SET embedding = $1::vector WHERE id = $2`, [JSON.stringify(embedding), id]);
};

export async function backfillMissingEvidenceEmbeddings(dependencies = {}) {
  const database = dependencies.database || pool;
  const embed = dependencies.embedding
    || (await import("./embedding.services.js")).generateDocumentEmbedding;
  const knowledge = await database.query(`
    SELECT id, cleaned_content, raw_content
    FROM approved_knowledge
    WHERE status = 'active' AND embedding IS NULL
    ORDER BY id
  `);
  const resources = await database.query(`
    SELECT r.id, r.name, r.description,
           COALESCE(array_agg(a.normalized_alias) FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases
    FROM official_resources r
    LEFT JOIN official_resource_aliases a ON a.resource_id = r.id
    WHERE r.active = TRUE AND r.embedding IS NULL
    GROUP BY r.id
  `);
  const facilities = await database.query(`
    SELECT f.id, f.name, f.description,
           COALESCE(array_agg(a.normalized_alias) FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases
    FROM facilities f
    LEFT JOIN facility_aliases a ON a.facility_id = f.id
    WHERE f.active = TRUE AND f.embedding IS NULL
    GROUP BY f.id
  `);

  for (const row of knowledge.rows) {
    const text = String(row.cleaned_content || row.raw_content || "").trim();
    if (!text) throw new Error(`Active knowledge ${row.id} has no content to embed`);
    await updateEmbedding(database, embed, { table: "approved_knowledge", id: row.id, text });
  }
  for (const row of resources.rows) {
    await updateEmbedding(database, embed, {
      table: "official_resources", id: row.id, text: buildOfficialResourceEmbeddingText(row),
    });
  }
  for (const row of facilities.rows) {
    await updateEmbedding(database, embed, {
      table: "facilities", id: row.id, text: buildFacilityEmbeddingText(row),
    });
  }

  const integrity = await database.query(`
    SELECT
      (SELECT COUNT(*)::integer FROM approved_knowledge WHERE status = 'active' AND embedding IS NULL) AS knowledge_missing,
      (SELECT COUNT(*)::integer FROM official_resources WHERE active = TRUE AND embedding IS NULL) AS resources_missing,
      (SELECT COUNT(*)::integer FROM facilities WHERE active = TRUE AND embedding IS NULL) AS facilities_missing
  `);
  const missing = integrity.rows[0];
  if (missing.knowledge_missing || missing.resources_missing || missing.facilities_missing) {
    throw new Error(`Evidence embedding integrity check failed: ${JSON.stringify(missing)}`);
  }
  return {
    knowledge: knowledge.rowCount,
    officialResources: resources.rowCount,
    facilities: facilities.rowCount,
  };
}

