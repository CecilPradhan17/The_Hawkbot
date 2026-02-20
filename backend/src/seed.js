/**
 * ADMIN SEED SCRIPT
 *
 * PURPOSE:
 * Populates the approved_knowledge table from knowledge.json.
 * Safe to re-run at any time — only new entries are processed.
 * Already-existing entries are skipped (checked by content match).
 *
 * USAGE:
 * node src/seed.js
 *
 * WORKFLOW:
 * 1. Read all entries from knowledge.json
 * 2. For each entry, check if it already exists in approved_knowledge
 * 3. If new: clean with LLM, generate embedding, insert
 * 4. If already exists: skip
 *
 * TO ADD NEW KNOWLEDGE:
 * - Add new strings to knowledge.json
 * - Re-run: node src/seed.js
 *
 * TO UPDATE AN ENTRY:
 * - Delete the row from approved_knowledge in psql
 * - Update the text in knowledge.json
 * - Re-run: node src/seed.js
 *
 * TO DELETE AN ENTRY:
 * - Delete the row from approved_knowledge in psql
 * - Remove the string from knowledge.json
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import pool from "./db.js";
import { cleanContent } from "./services/llm.services.js";
import { generateEmbedding } from "./services/embedding.services.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  // Load knowledge file
  const knowledgePath = join(__dirname, "../knowledge.json");
  const entries = JSON.parse(readFileSync(knowledgePath, "utf-8"));

  if (!Array.isArray(entries) || entries.length === 0) {
    console.log("knowledge.json is empty or invalid. Nothing to seed.");
    process.exit(0);
  }

  console.log(`📚 Found ${entries.length} entries in knowledge.json`);

  let inserted = 0;
  let skipped = 0;

  for (const rawContent of entries) {
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      console.warn("⚠️  Skipping invalid entry:", rawContent);
      skipped++;
      continue;
    }

    // Check if this content already exists in approved_knowledge
    const existing = await pool.query(
      `SELECT id FROM approved_knowledge WHERE cleaned_content = $1`,
      [rawContent.trim()]
    );

    if (existing.rows.length > 0) {
      console.log(`⏭️  Already exists, skipping: "${rawContent.substring(0, 60)}..."`);
      skipped++;
      continue;
    }

    try {
      console.log(`⚙️  Processing: "${rawContent.substring(0, 60)}..."`);

      // Clean with LLM
      const cleanedContent = await cleanContent({
        type: "post",
        content: rawContent,
      });

      // Generate embedding
      const embedding = await generateEmbedding(cleanedContent);

      // Insert into approved_knowledge
      // source_post_id is NULL for admin-seeded entries
      await pool.query(
        `INSERT INTO approved_knowledge (source_post_id, cleaned_content, embedding)
         VALUES ($1, $2, $3)`,
        [null, cleanedContent, JSON.stringify(embedding)]
      );

      console.log(`✅ Inserted: "${cleanedContent.substring(0, 60)}..."`);
      inserted++;
    } catch (err) {
      console.error(`❌ Failed to process entry: "${rawContent.substring(0, 60)}..."`, err.message);
    }
  }

  console.log(`\n🎉 Done! ${inserted} inserted, ${skipped} skipped.`);
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});