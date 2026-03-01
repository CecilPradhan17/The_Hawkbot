import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * PURPOSE:
 * Generates vector embeddings using OpenAI's text-embedding-3-large model.
 *
 * MODEL CHOICE:
 * Upgraded from text-embedding-3-small to text-embedding-3-large for
 * significantly better retrieval quality. The large model produces
 * 3072-dimensional vectors and is much better at distinguishing subtle
 * semantic differences (e.g. "Saturday hours" vs "Friday hours" for
 * the same location). Cost difference is negligible at our scale.
 *
 * ASYMMETRIC SEARCH (future):
 * Split into generateDocumentEmbedding and generateQueryEmbedding
 * for when we need to optimize query vs document embeddings differently.
 * Currently both are identical but the split is architecturally correct.
 *
 * USED BY:
 * - approval.service.js → generateDocumentEmbedding
 * - seed.js             → generateDocumentEmbedding (via generateEmbedding)
 * - chatbot.service.js  → generateQueryEmbedding
 * - diagnostic.js       → generateQueryEmbedding
 *
 * COST NOTE:
 * text-embedding-3-large: ~$0.00013 per 1K tokens
 * At our scale (29 seed entries + ~300 queries): < $0.05 total
 */

/**
 * Generates an embedding for content being stored in the knowledge base.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export const generateDocumentEmbedding = async (text) => {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    encoding_format: "float",
  });
  return response.data[0].embedding;
};

/**
 * Generates an embedding for a user's search query.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export const generateQueryEmbedding = async (text) => {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    encoding_format: "float",
  });
  return response.data[0].embedding;
};

/**
 * Legacy export — kept for backward compatibility with seed.js
 * and approval.service.js that still import generateEmbedding.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export const generateEmbedding = generateDocumentEmbedding;