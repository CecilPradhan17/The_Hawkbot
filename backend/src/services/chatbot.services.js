import pool from "../db.js";
import { generateEmbedding } from "./embedding.services.js";
import { polishResponse } from "./llm.services.js";

/**
 * PURPOSE:
 * Orchestrates the full RAG flow for chatbot queries.
 *
 * FLOW:
 * 1. Generate embedding for the user's query
 * 2. Run cosine similarity search on approved_knowledge
 * 3a. If similarity >= threshold: polish retrieved knowledge with LLM
 * 3b. If no match: return fallback message
 *
 * CONSTRAINTS:
 * - LLM is never asked to generate new campus information
 * - Only approved, human-voted knowledge is used
 * - Fallback is returned honestly when no match is found
 *
 * USED BY:
 * chatbot.controller.js
 */

const SIMILARITY_THRESHOLD = 0.50;

const FALLBACK_MESSAGE =
  "I don't have verified information about that yet. " +
  "Try asking a question on the feed — if the community answers and votes it up, " +
  "I'll be able to help with that in the future!";

export const handleChatQuery = async (userMessage) => {
  // Step 1: Embed the user's query
  const queryEmbedding = await generateEmbedding(userMessage);

  // Step 2: Search for similar knowledge using cosine similarity
  const result = await pool.query(
    `SELECT cleaned_content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM approved_knowledge
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [JSON.stringify(queryEmbedding)]
  );

  // Step 3a: No match or similarity below threshold — return fallback
  if (result.rows.length === 0 || result.rows[0].similarity < SIMILARITY_THRESHOLD) {
    return { response: FALLBACK_MESSAGE, matched: false };
  }

  // Step 3b: Strong match — polish with LLM and return
  const { cleaned_content, similarity } = result.rows[0];
  const polished = await polishResponse(userMessage, cleaned_content);

  return {
    response: polished,
    matched: true,
    similarity,
  };
};