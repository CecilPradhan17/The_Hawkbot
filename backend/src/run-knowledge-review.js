import pool from "./db.js";
import { runKnowledgeReview } from "./services/knowledge-review.services.js";

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  const result = await runKnowledgeReview();
  console.log(
    `Knowledge review complete: ${result.resolved.length} expired review(s) handled, ${result.created.length} new review(s) created.`,
  );
} catch (error) {
  console.error("Knowledge review failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
