import pool from "../db.js";

export async function getApprovedHawkWallSource(sourcePostId, userId, database = pool) {
  const sourceResult = await database.query(
    `SELECT source.id AS source_post_id,
            COALESCE(source.parent_id, source.id) AS thread_post_id
     FROM approved_knowledge knowledge
     JOIN posts source ON source.id = knowledge.source_post_id
     WHERE knowledge.source_post_id = $1
       AND knowledge.status = 'active'
     ORDER BY knowledge.id
     LIMIT 1`,
    [sourcePostId],
  );
  if (sourceResult.rows.length === 0) return null;

  const { source_post_id: verifiedSourcePostId, thread_post_id: threadPostId } = sourceResult.rows[0];
  const threadResult = await database.query(
    `SELECT post.*, vote.vote AS user_vote
     FROM posts post
     LEFT JOIN post_votes vote
       ON vote.post_id = post.id AND vote.user_id = $2
     WHERE post.id = $1`,
    [threadPostId, userId],
  );
  if (threadResult.rows.length === 0) return null;

  const post = threadResult.rows[0];
  let answers = null;
  if (post.type === "question") {
    const answerResult = await database.query(
      `SELECT answer.*, vote.vote AS user_vote
       FROM posts answer
       LEFT JOIN post_votes vote
         ON vote.post_id = answer.id AND vote.user_id = $2
       WHERE answer.parent_id = $1
       ORDER BY answer.created_at ASC`,
      [threadPostId, userId],
    );
    answers = answerResult.rows;
  }

  return {
    post,
    answers,
    sourcePostId: Number(verifiedSourcePostId),
  };
}
