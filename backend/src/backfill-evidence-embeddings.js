import "dotenv/config";
import pool from "./db.js";
import { backfillMissingEvidenceEmbeddings } from "./services/evidence-backfill.services.js";

try {
  const counts = await backfillMissingEvidenceEmbeddings({ database: pool });
  console.log(
    `Backfilled ${counts.knowledge} knowledge rows, ${counts.officialResources} official resources, and ${counts.facilities} facilities.`,
  );
  console.log("Evidence embedding integrity check passed.");
} finally {
  await pool.end();
}
