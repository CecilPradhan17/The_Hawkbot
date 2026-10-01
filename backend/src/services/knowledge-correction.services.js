const PREFIX = "Hawkbot needs an update. This information was marked outdated:\n“";
const SUFFIX = "”\n\nWhat is the current correct information?";
const MAX_POST_LENGTH = 250;

export const buildCorrectionQuestionContent = fact => {
  const text = String(fact).trim().replace(/\s+/g, " ");
  const available = MAX_POST_LENGTH - PREFIX.length - SUFFIX.length;
  const shortened = text.length > available
    ? `${text.slice(0, Math.max(available - 1, 0)).trimEnd()}…`
    : text;
  return `${PREFIX}${shortened}${SUFFIX}`;
};

export const createCorrectionQuestion = async (
  client,
  { knowledgeId, fact, createdAt = new Date() },
) => {
  const existing = await client.query(
    `SELECT id, question_post_id
     FROM knowledge_correction_questions
     WHERE knowledge_id = $1 AND status = 'open'`,
    [knowledgeId],
  );
  if (existing.rowCount > 0) {
    return { created: false, postId: existing.rows[0].question_post_id };
  }

  const systemUser = await client.query(
    "SELECT id FROM users WHERE is_system = TRUE LIMIT 1",
  );
  if (systemUser.rowCount !== 1) throw new Error("Hawkbot system account is missing");

  const post = await client.query(
    `INSERT INTO posts (content, author_id, type, parent_id, created_at)
     VALUES ($1, $2, 'question', NULL, $3)
     RETURNING id`,
    [buildCorrectionQuestionContent(fact), systemUser.rows[0].id, createdAt],
  );
  await client.query(
    `INSERT INTO knowledge_correction_questions
       (knowledge_id, question_post_id, status, created_at)
     VALUES ($1, $2, 'open', $3)`,
    [knowledgeId, post.rows[0].id, createdAt],
  );
  return { created: true, postId: post.rows[0].id };
};
