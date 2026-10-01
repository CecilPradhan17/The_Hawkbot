CREATE TABLE knowledge_correction_questions (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES approved_knowledge(id) ON DELETE CASCADE,
  question_post_id INTEGER NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  replacement_knowledge_id INTEGER REFERENCES approved_knowledge(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK (
    (status = 'open' AND resolved_at IS NULL)
    OR (status <> 'open' AND resolved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX knowledge_correction_questions_one_open_per_fact_idx
  ON knowledge_correction_questions (knowledge_id)
  WHERE status = 'open';

CREATE INDEX knowledge_correction_questions_open_question_idx
  ON knowledge_correction_questions (question_post_id)
  WHERE status = 'open';
