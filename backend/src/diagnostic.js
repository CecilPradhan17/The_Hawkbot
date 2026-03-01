/**
 * DIAGNOSTIC SCRIPT
 * Tests the actual similarity score of a query against approved_knowledge.
 *
 * USAGE:
 * node src/diagnostic.js "When does the AC close on Saturdays?"
 */

import "dotenv/config";
import pool from "./db.js";
import { generateEmbedding } from "./services/embedding.services.js";

const query = process.argv[2];

if (!query) {
  console.error('Please provide a query. Usage: node src/diagnostic.js "your question here"');
  process.exit(1);
}

const run = async () => {
  console.log(`\n🔍 Query: "${query}"\n`);

  const embedding = await generateEmbedding(query);

  const result = await pool.query(
    `SELECT cleaned_content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM approved_knowledge
     ORDER BY embedding <=> $1::vector
     LIMIT 5`,
    [JSON.stringify(embedding)]
  );

  if (result.rows.length === 0) {
    console.log("No entries in approved_knowledge.");
    process.exit(0);
  }

  console.log("Top 5 matches:\n");
  result.rows.forEach((row, i) => {
    console.log(`${i + 1}. Similarity: ${parseFloat(row.similarity).toFixed(4)}`);
    console.log(`   Content: ${row.cleaned_content.substring(0, 120)}...\n`);
  });

  process.exit(0);
};

run().catch((err) => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});