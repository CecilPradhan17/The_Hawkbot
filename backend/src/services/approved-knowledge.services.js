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

  // Complete external embedding calls before opening a database transaction.
  const embeddedChunks = await Promise.all(
    chunks.map(async (cleanedContent) => ({
      cleanedContent,
      embedding: await generateEmbedding(cleanedContent),
    }))
  );

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    for (const { cleanedContent, embedding } of embeddedChunks) {
      await client.query(
        `INSERT INTO approved_knowledge (source_post_id, cleaned_content, raw_content, embedding)
         VALUES ($1, $2, $3, $4)`,
        [sourcePostId, cleanedContent, rawContent, JSON.stringify(embedding)]
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
