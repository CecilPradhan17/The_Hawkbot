import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * PURPOSE:
 * Two responsibilities:
 * 1. cleanContent() - transforms raw content into a retrieval-optimized Q+A format.
 * 2. polishResponse() - rewrites retrieved knowledge conversationally for the user.
 *
 * KEY DESIGN DECISIONS:
 * - All content stored as "Q: ...\nA: ..." format for better embedding recall
 * - Question phrasings include both full names AND abbreviations/short forms/nicknames
 * - Day-specific facts MUST have day-specific questions only — no generic phrasings
 *   that would cause retrieval conflicts between entries for different days
 * - LLM is never asked to generate new campus information
 */

const DAY_SPECIFIC_INSTRUCTION = `
CRITICAL RULE: If the fact is specific to a particular day (e.g. mentions Monday, Saturday, Sundays etc.),
ALL question phrasings MUST include that specific day.
NEVER write generic phrasings like "What are the hours?" or "What time does X open?" without the day name.
Generic phrasings cause retrieval conflicts with other day-specific entries and break the chatbot.
Good example for a Saturday fact: "What time does the AC open on Saturdays?" / "When does the AC close on Saturdays?" / "Is the AC open on Saturdays?"
Bad example: "What are the AC hours?" / "When does the AC open?" (no day = conflict)`;

/**
 * Transforms raw content into a retrieval-optimized Q+A format.
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
1. Write 4-5 natural question phrasings that students might ask to find this information.
   - If the fact mentions a place, building, or service that has a common abbreviation, short form, or colloquial nickname (e.g. "Activity Center" → "AC", "Student Success Center" → "SSC", "Schulze Dining Hall" → "cafeteria" / "dining hall" / "the caf"), include question phrasings that use both the official name and the informal names students might use.
   - Cover different angles: opening time, closing time, whether it is open at all.
   ${DAY_SPECIFIC_INSTRUCTION}
2. Write a clean, clear answer based strictly on the fact provided. Include both the full name and any common abbreviation or nickname if one exists (e.g. "Activity Center (AC)", "Schulze Dining Hall (also known as the cafeteria)").

Return in this exact format:
Q: <question 1> | <question 2> | <question 3> | <question 4> | <question 5>
A: <clean answer>

Do not add any information not present in the fact. Do not add any preamble or explanation.

Fact: "${content}"`;
  } else {
    prompt = `You are preparing campus knowledge for a university chatbot's knowledge base.

Given the following student question and answer, do two things:
1. Write 4-5 natural question phrasings that students might ask to find this information (include the original question).
   - If the question or answer mentions a place, building, or service that has a common abbreviation, short form, or colloquial nickname (e.g. "Activity Center" → "AC", "Student Success Center" → "SSC", "Schulze Dining Hall" → "cafeteria" / "dining hall" / "the caf"), include question phrasings that use both the official name and the informal names students might use.
   - Cover different angles: opening time, closing time, whether it is open at all.
   ${DAY_SPECIFIC_INSTRUCTION}
2. Write a clean, clear answer based strictly on the answer provided. Include both the full name and any common abbreviation or nickname if one exists (e.g. "Activity Center (AC)", "Schulze Dining Hall (also known as the cafeteria)").

Return in this exact format:
Q: <question 1> | <question 2> | <question 3> | <question 4> | <question 5>
A: <clean answer>

Do not add any information not present in the answer. Do not add any preamble or explanation.

Question: "${question}"
Answer: "${answer}"`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 400,
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