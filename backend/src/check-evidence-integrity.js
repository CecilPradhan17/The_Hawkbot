import "dotenv/config";
import pool from "./db.js";

try {
  const { rows: [counts] } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::integer FROM approved_knowledge WHERE status = 'active') AS active_knowledge,
      (SELECT COUNT(*)::integer FROM approved_knowledge WHERE status = 'active' AND embedding IS NULL) AS knowledge_missing,
      (SELECT COUNT(*)::integer FROM official_resources WHERE active = TRUE AND embedding IS NULL) AS resources_missing,
      (SELECT COUNT(*)::integer FROM facilities WHERE active = TRUE AND embedding IS NULL) AS facilities_missing
  `);
  console.log(JSON.stringify(counts));
  if (counts.knowledge_missing || counts.resources_missing || counts.facilities_missing) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
