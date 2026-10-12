import "dotenv/config";
import pool from "./db.js";
import { generateDocumentEmbedding } from "./services/embedding.services.js";
import {
  buildFacilityEmbeddingText,
  buildOfficialResourceEmbeddingText,
} from "./services/evidence-embedding.services.js";

const backfill = async ({ table, id, text }) => {
  const embedding = await generateDocumentEmbedding(text);
  await pool.query(`UPDATE ${table} SET embedding = $1::vector WHERE id = $2`, [JSON.stringify(embedding), id]);
};

try {
  const resources = await pool.query(`
    SELECT r.id, r.name, r.description,
           COALESCE(array_agg(a.normalized_alias) FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases
    FROM official_resources r
    LEFT JOIN official_resource_aliases a ON a.resource_id = r.id
    WHERE r.active = TRUE AND r.embedding IS NULL
    GROUP BY r.id
  `);
  const facilities = await pool.query(`
    SELECT f.id, f.name, f.description,
           COALESCE(array_agg(a.normalized_alias) FILTER (WHERE a.id IS NOT NULL), '{}') AS aliases
    FROM facilities f
    LEFT JOIN facility_aliases a ON a.facility_id = f.id
    WHERE f.active = TRUE AND f.embedding IS NULL
    GROUP BY f.id
  `);

  for (const row of resources.rows) {
    await backfill({
      table: "official_resources", id: row.id,
      text: buildOfficialResourceEmbeddingText(row),
    });
  }
  for (const row of facilities.rows) {
    await backfill({
      table: "facilities", id: row.id,
      text: buildFacilityEmbeddingText(row),
    });
  }
  console.log(`Backfilled ${resources.rowCount} official resources and ${facilities.rowCount} facilities.`);
} finally {
  await pool.end();
}
