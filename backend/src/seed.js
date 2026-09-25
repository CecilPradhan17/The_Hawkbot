/**
 * ADMIN SEED SCRIPT
 *
 * PURPOSE:
 * Populates the approved_knowledge table from knowledge.json.
 * Safe to re-run at any time — only new entries are processed.
 * Already-existing entries are skipped (checked by raw content match).
 *
 * USAGE:
 * node src/seed.js
 *
 * WORKFLOW:
 * 1. Read all entries from knowledge.json
 * 2. For each entry, check if it already exists in approved_knowledge
 * 3. If new: generate retrieval-optimized Q+A, embed, insert
 * 4. If already exists: skip
 *
 * TO ADD NEW KNOWLEDGE:
 * - Add new strings to knowledge.json
 * - Re-run: node src/seed.js
 *
 * TO UPDATE AN ENTRY:
 * - Delete the row from approved_knowledge in psql:
 *     DELETE FROM approved_knowledge WHERE source_post_id IS NULL AND cleaned_content LIKE '%your text%';
 * - Update the string in knowledge.json
 * - Re-run: node src/seed.js
 *
 * TO DELETE AN ENTRY:
 * - Delete the row from approved_knowledge in psql
 * - Remove the string from knowledge.json
 *
 * TO RESEED EVERYTHING FROM SCRATCH:
 * - Run in psql: DELETE FROM approved_knowledge WHERE source_post_id IS NULL;
 * - Re-run: node src/seed.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import pool from "./db.js";
import { curateKnowledge } from "./services/llm.services.js";
import { generateEmbedding } from "./services/embedding.services.js";
import { storeApprovedKnowledge } from "./services/approved-knowledge.services.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const knowledgePath = join(__dirname, "../knowledge.json");
  const entries = JSON.parse(readFileSync(knowledgePath, "utf-8"));

  if (!Array.isArray(entries) || entries.length === 0) {
    console.log("knowledge.json is empty or invalid. Nothing to seed.");
    process.exit(0);
  }

  console.log(`📚 Found ${entries.length} entries in knowledge.json\n`);

  let inserted = 0;
  let skipped = 0;

  for (const rawContent of entries) {
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      console.warn("⚠️  Skipping invalid entry:", rawContent);
      skipped++;
      continue;
    }

    // Check if this raw content has already been seeded
    // We store the raw content in a separate column to track this
    const existing = await pool.query(
      `SELECT id FROM approved_knowledge WHERE raw_content = $1`,
      [rawContent.trim()]
    );

    if (existing.rows.length > 0) {
      console.log(`⏭️  Already exists, skipping: "${rawContent.substring(0, 60)}..."`);
      skipped++;
      continue;
    }

    try {
      console.log(`⚙️  Processing: "${rawContent.substring(0, 60)}..."`);

      // Generate retrieval-optimized Q+A format
      const knowledgeChunks = await curateKnowledge({
        type: "post",
        content: rawContent,
      });

      console.log(`   Curated into ${knowledgeChunks.length} fact(s)`);

      await storeApprovedKnowledge({
        db: pool,
        sourcePostId: null,
        rawContent: rawContent.trim(),
        chunks: knowledgeChunks,
        generateEmbedding,
      });

      console.log(`✅ Inserted\n`);
      inserted++;
    } catch (err) {
      console.error(`❌ Failed: "${rawContent.substring(0, 60)}..."`, err.message, "\n");
    }
  }

  console.log(`🎉 Done! ${inserted} inserted, ${skipped} skipped.`);
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
