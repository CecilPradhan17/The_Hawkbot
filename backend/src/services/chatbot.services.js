import pool from "../db.js";
import { generateQueryEmbedding } from "./embedding.service.js";
import { polishResponse } from "./llm.service.js";

/**
 * PURPOSE:
 * Orchestrates the full RAG flow for chatbot queries.
 *
 * FLOW:
 * 1. Generate a QUERY embedding for the user's message (asymmetric search)
 * 2. Retrieve top 3 matches by cosine similarity from approved_knowledge
 * 3a. If best match >= threshold: send all matches to LLM to synthesize answer
 * 3b. If no match: return fallback message
 *
 * CHANGES FROM V1:
 * - Now uses generateQueryEmbedding instead of generateEmbedding
 *   for better asymmetric retrieval (query vs document embedding types)
 * - Retrieves top 3 instead of top 1, letting the LLM pick the best answer
 *   from multiple candidates — handles cases where the best match is #2 or #3
 *
 * CONSTRAINTS:
 * - LLM is never asked to generate new campus information
 * - Only approved, human-voted knowledge is used
 * - Fallback is returned honestly when no match is found
 */

const SIMILARITY_THRESHOLD = 0.50;

const FALLBACK_MESSAGE =
  "I don't have verified information about that yet. " +
  "Try asking a question on the feed — if the community answers and votes it up, " +
  "I'll be able to help with that in the future!";

export const handleChatQuery = async (userMessage) => {
  // Step 1: Embed the user's query using query-optimized embedding
  const queryEmbedding = await generateQueryEmbedding(userMessage);

  // Step 2: Retrieve top 3 matches by cosine similarity
  const result = await pool.query(
    `SELECT cleaned_content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM approved_knowledge
     ORDER BY embedding <=> $1::vector
     LIMIT 3`,
    [JSON.stringify(queryEmbedding)]
  );

  const topMatch = result.rows[0];
  const similarity = topMatch ? parseFloat(topMatch.similarity).toFixed(4) : null;

  // Log for debugging
  console.log(`[chatbot] query="${userMessage}" | top_similarity=${similarity} | threshold=${SIMILARITY_THRESHOLD}`);
  result.rows.forEach((row, i) => {
    console.log(`[chatbot] match ${i + 1}: similarity=${parseFloat(row.similarity).toFixed(4)} | "${row.cleaned_content.substring(0, 60)}..."`);
  });

  // Step 3a: Best match below threshold — return fallback
  if (!topMatch || topMatch.similarity < SIMILARITY_THRESHOLD) {
    console.log(`[chatbot] No match — returning fallback`);
    return { response: FALLBACK_MESSAGE, matched: false };
  }

  // Step 3b: Combine top matches into context and polish with LLM
  // Sending all 3 lets the LLM synthesize a better answer when
  // the question spans multiple entries (e.g. "what are the AC weekend hours?")
  const combinedKnowledge = result.rows
    .filter(row => row.similarity >= SIMILARITY_THRESHOLD)
    .map(row => row.cleaned_content)
    .join("\n\n");

  console.log(`[chatbot] ${result.rows.filter(r => r.similarity >= SIMILARITY_THRESHOLD).length} match(es) above threshold — polishing`);

  const polished = await polishResponse(userMessage, combinedKnowledge);

  return {
    response: polished,
    matched: true,
    similarity,
  };
};