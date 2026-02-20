import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * PURPOSE:
 * Two responsibilities:
 * 1. cleanContent() - called once at approval/seed time to transform raw content
 *    into a retrieval-optimized Q+A format for the vector store.
 * 2. polishResponse() - called at query time to rewrite retrieved knowledge
 *    conversationally for the end user.
 *
 * KEY DESIGN DECISION:
 * All content is stored as "Q: ...\nA: ..." format regardless of source.
 * This dramatically improves embedding recall because:
 * - Users ask questions conversationally
 * - Storing question phrasings alongside the answer closes the vector space gap
 * - The embedding captures both "how users ask" and "what the answer is"
 *
 * USED BY:
 * - approval.service.js → cleanContent()
 * - seed.js → cleanContent()
 * - chatbot.service.js → polishResponse()
 */

/**
 * Transforms raw content into a retrieval-optimized Q+A format.
 * For facts: generates natural question phrasings + clean answer.
 * For Q+A pairs: cleans and structures the existing question + answer.
 *
 * @param {object} params
 * @param {'post' | 'question'} params.type
 * @param {string} [params.content] - raw fact/statement (for type='post')
 * @param {string} [params.question] - raw question (for type='question')
 * @param {string} [params.answer] - raw answer (for type='question')
 * @returns {Promise<string>} retrieval-optimized "Q: ...\nA: ..." string
 */
export const cleanContent = async ({ type, content, question, answer }) => {
  let prompt;

  if (type === "post") {
    prompt = `You are preparing campus knowledge for a university chatbot's knowledge base.

Given the following campus fact, do two things:
1. Write 2-3 natural question phrasings that students might ask to find this information
2. Write a clean, clear answer based strictly on the fact provided

Return in this exact format:
Q: <question 1> | <question 2> | <question 3>
A: <clean answer>

Do not add any information not present in the fact. Do not add any preamble or explanation.

Fact: "${content}"`;
  } else {
    prompt = `You are preparing campus knowledge for a university chatbot's knowledge base.

Given the following student question and answer, do two things:
1. Write 2-3 natural question phrasings that students might ask to find this information (include the original question)
2. Write a clean, clear answer based strictly on the answer provided

Return in this exact format:
Q: <question 1> | <question 2> | <question 3>
A: <clean answer>

Do not add any information not present in the answer. Do not add any preamble or explanation.

Question: "${question}"
Answer: "${answer}"`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 300,
  });

  return response.choices[0].message.content.trim();
};

/**
 * Rewrites retrieved knowledge as a conversational chatbot response.
 * The LLM is only allowed to use the provided knowledge — no hallucination.
 *
 * @param {string} userQuery - the original user question
 * @param {string} knowledge - the cleaned_content retrieved from approved_knowledge
 * @returns {Promise<string>} polished conversational response
 */
export const polishResponse = async (userQuery, knowledge) => {
  const prompt = `You are a helpful university campus assistant chatbot.
A student asked: "${userQuery}"

Using ONLY the following campus knowledge, respond conversationally and helpfully in 1-2 sentences.
Do not add any information that is not in the knowledge provided.
If the knowledge does not fully answer the question, say so honestly.

Knowledge: "${knowledge}"`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 150,
  });

  return response.choices[0].message.content.trim();
};