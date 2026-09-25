import pool from "../db.js";
import { curateKnowledge } from "./llm.services.js";
import { generateEmbedding } from "./embedding.services.js";
import { storeApprovedKnowledge } from "./approved-knowledge.services.js";

/**
 * PURPOSE:
 * Orchestrates the full approval workflow when an answer reaches
 * the vote threshold in vote.service.js.
 *
 * WORKFLOW:
 * 1. Fetch the approved answer and its parent question from posts
 * 2. Call the LLM once to split and clean it into atomic facts
 * 3. Generate one embedding per fact
 * 4. Store every fact atomically in approved_knowledge
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

    // Curate the Q+A pair using one LLM call per approval.
    const knowledgeChunks = await curateKnowledge({
      type: "question",
      question: question.content,
      answer: answer.content,
    });

    await storeApprovedKnowledge({
      db: pool,
      sourcePostId: answer.id,
      chunks: knowledgeChunks,
      generateEmbedding,
    });

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

    const knowledgeChunks = await curateKnowledge({
      type: "post",
      content: post.content,
    });

    await storeApprovedKnowledge({
      db: pool,
      sourcePostId: post.id,
      chunks: knowledgeChunks,
      generateEmbedding,
    });

    console.log(`Approved knowledge stored for post ID ${postId}`);
  } catch (err) {
    console.error("processPostApproval failed:", err);
  }
};
