import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * PURPOSE:
 * Generates a vector embedding for a given text string
 * using OpenAI's text-embedding-3-small model.
 *
 * USED BY:
 * - approval.service.js (embed cleaned content before storing)
 * - chatbot.service.js (embed user query before similarity search)
 *
 * COST NOTE:
 * text-embedding-3-small is the cheapest OpenAI embedding model.
 * Outputs 1536-dimensional vectors.
 */
export const generateEmbedding = async (text) => {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
};