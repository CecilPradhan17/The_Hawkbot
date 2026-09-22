import pool from "../db.js";
import { generateQueryEmbedding } from "./embedding.services.js";
import { polishResponse } from "./llm.services.js";
import { tryHandleHoursQuery } from "./hours-chat.services.js";
import { tryHandleSmalltalk } from "./smalltalk.services.js";

/**
 * Orchestrates deterministic structured answers before the existing RAG flow.
 * A confident hours match returns immediately without an embedding or LLM call.
 * Uncertain and non-hours questions preserve the original RAG behavior.
 */
const SIMILARITY_THRESHOLD = 0.50;

const FALLBACK_MESSAGE =
  "I don't have the answer to that yet. Try posting this question on the HawkWall and another student can answer you!";

export const handleChatQuery = async (userMessage, dependencies = {}) => {
  const smalltalkHandler = dependencies.smalltalkHandler || tryHandleSmalltalk;
  const hoursHandler = dependencies.hoursHandler || tryHandleHoursQuery;
  const embedding = dependencies.embedding || generateQueryEmbedding;
  const database = dependencies.database || pool;
  const polisher = dependencies.polisher || polishResponse;

  const smalltalkResult = await smalltalkHandler(userMessage);
  if (smalltalkResult) return smalltalkResult;

  // Structured campus hours are authoritative for recognized hours questions.
  // An uncovered date returns an explicit unverified response rather than stale RAG data.
  const hoursResult = await hoursHandler(userMessage);
  if (hoursResult) return hoursResult;

  const queryEmbedding = await embedding(userMessage);
  const result = await database.query(
    `SELECT cleaned_content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM approved_knowledge
     ORDER BY embedding <=> $1::vector
     LIMIT 3`,
    [JSON.stringify(queryEmbedding)]
  );

  const topMatch = result.rows[0];
  const similarity = topMatch ? parseFloat(topMatch.similarity).toFixed(4) : null;
  if (!topMatch || topMatch.similarity < SIMILARITY_THRESHOLD) {
    return { response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" };
  }

  const combinedKnowledge = result.rows
    .filter(row => row.similarity >= SIMILARITY_THRESHOLD)
    .map(row => row.cleaned_content)
    .join("\n\n");
  const polished = await polisher(userMessage, combinedKnowledge);
  if (!polished?.answerable || !polished.response?.trim()) {
    return { response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" };
  }
  return { response: polished.response.trim(), matched: true, similarity, sourceType: "rag" };
};
