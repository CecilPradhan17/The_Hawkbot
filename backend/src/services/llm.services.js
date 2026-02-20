import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * PURPOSE:
 * Two responsibilities:
 * 1. cleanContent() - called once at approval time to clean raw post content
 *    into a well-structured knowledge chunk for the vector store.
 * 2. polishResponse() - called at query time to rewrite retrieved knowledge
 *    conversationally for the end user.
 *
 * USED BY:
 * - approval.service.js → cleanContent()
 * - chatbot.service.js → polishResponse()
 *
 * COST NOTE:
 * gpt-4o-mini is used for both tasks. LLM is only called:
 * - Once per approved post (cleaning)
 * - Once per chatbot query that finds a strong match (polishing)
 * It is never called to generate new campus information.
 */

/**
 * Cleans a raw post or question+answer pair into a structured knowledge chunk.
 * @param {object} params
 * @param {'post' | 'question'} params.type
 * @param {string} params.content - raw post content (for type='post')
 * @param {string} [params.question] - raw question content (for type='question')
 * @param {string} [params.answer] - raw answer content (for type='question')
 * @returns {Promise<string>} cleaned content string
 */
export const cleanContent = async ({ type, content, question, answer }) => {
  let prompt;

  if (type === "post") {
    prompt = `You are cleaning a student-submitted campus knowledge post for a university chatbot knowledge base.
Clean the following post by fixing grammar, improving clarity, and making it a clear factual statement.
Do not add any new information. Do not answer questions. Just clean and rewrite the statement.
Return only the cleaned text, nothing else.

Post: "${content}"`;
  } else {
    prompt = `You are cleaning a student-submitted campus Q&A for a university chatbot knowledge base.
Clean the following question and answer by fixing grammar and improving clarity.
Do not add any new information. Keep it factual and concise.
Return in this exact format:
Question: <cleaned question>
Answer: <cleaned answer>

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
 * @param {string} userQuery - the original user question
 * @param {string} knowledge - the cleaned_content retrieved from approved_knowledge
 * @returns {Promise<string>} polished conversational response
 */
export const polishResponse = async (userQuery, knowledge) => {
  const prompt = `You are a helpful university campus assistant chatbot.
A student asked: "${userQuery}"

Using ONLY the following campus knowledge, respond conversationally and helpfully.
Do not add any information that is not in the knowledge provided.
If the knowledge does not fully answer the question, say so honestly.

Knowledge: "${knowledge}"`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 200,
  });

  return response.choices[0].message.content.trim();
};