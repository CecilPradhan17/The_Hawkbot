import pool from "../db.js";
import { cleanContent } from "./llm.services.js";
import { generateEmbedding } from "./embedding.services.js";

/**
 * PURPOSE:
 * Orchestrates the full approval workflow when an answer reaches
 * the vote threshold in vote.service.js.
 *
 * WORKFLOW:
 * 1. Fetch the approved answer and its parent question from posts
 * 2. Call LLM once to clean the content
 * 3. Generate embedding from cleaned content
 * 4. Insert into approved_knowledge
 *
 * USED BY:
 * - vote.service.js -> processApproval()
 *
 * NOTE:
 * This function is fire-and-forget from vote.service.js.
 * Errors are caught and logged without disrupting the vote response.
 */
export const processApproval = async (answerId, parentQuestionId) => {
  try {
    const answerRes = await pool.query(
      `SELECT id, content FROM posts WHERE id = $1`,
      [answerId]
    );

    const questionRes = await pool.query(
      `SELECT id, content FROM posts WHERE id = $1`,
      [parentQuestionId]
    );

    if (answerRes.rows.length === 0 || questionRes.rows.length === 0) {
      console.error("processApproval: could not find answer or question posts");
      return;
    }

    const answer = answerRes.rows[0];
    const question = questionRes.rows[0];

    // Clean the Q+A pair using LLM (called once per approval)
    const cleanedContent = await cleanContent({
      type: "question",
      question: question.content,
      answer: answer.content,
    });

    // Generate embedding from cleaned content
    const embedding = await generateEmbedding(cleanedContent);

    // Insert into approved_knowledge
    await pool.query(
      `INSERT INTO approved_knowledge (source_post_id, cleaned_content, embedding)
       VALUES ($1, $2, $3)`,
      [answer.id, cleanedContent, JSON.stringify(embedding)]
    );

    console.log(`Approved knowledge stored for answer ID ${answerId}`);
  } catch (err) {
    console.error("processApproval failed:", err);
  }
};

/**
 * Handles approval of a standalone post (type='post').
 * Kept for future use if voting is ever added to posts.
 */
export const processPostApproval = async (postId) => {
  try {
    const postRes = await pool.query(
      `SELECT id, content FROM posts WHERE id = $1`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      console.error("processPostApproval: post not found");
      return;
    }

    const post = postRes.rows[0];

    const cleanedContent = await cleanContent({
      type: "post",
      content: post.content,
    });

    const embedding = await generateEmbedding(cleanedContent);

    await pool.query(
      `INSERT INTO approved_knowledge (source_post_id, cleaned_content, embedding)
       VALUES ($1, $2, $3)`,
      [post.id, cleanedContent, JSON.stringify(embedding)]
    );

    console.log(`Approved knowledge stored for post ID ${postId}`);
  } catch (err) {
    console.error("processPostApproval failed:", err);
  }
};