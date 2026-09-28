import { calculateNextReviewAt } from "./knowledge-review.services.js";

export const storeApprovedKnowledge = async ({
  db,
  sourcePostId,
  rawContent = null,
  chunks,
  generateEmbedding,
}) => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("At least one knowledge chunk is required");
  }

  const verifiedAt = new Date();

  // Complete external embedding calls before opening a database transaction.
  const embeddedChunks = await Promise.all(
    chunks.map(async (chunk) => ({
      ...chunk,
      embedding: await generateEmbedding(chunk.content),
    }))
  );

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    for (const { content, reviewCategory, embedding } of embeddedChunks) {
      const reviewDueAt = calculateNextReviewAt(reviewCategory, verifiedAt);
      await client.query(
        `INSERT INTO approved_knowledge
           (source_post_id, cleaned_content, raw_content, embedding, review_category,
            last_verified_at, review_due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sourcePostId, content, rawContent, JSON.stringify(embedding), reviewCategory,
          verifiedAt, reviewDueAt]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
