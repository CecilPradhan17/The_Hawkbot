CREATE TABLE knowledge_outdated_reports (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES approved_knowledge(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX knowledge_outdated_reports_one_open_per_user_idx
  ON knowledge_outdated_reports (knowledge_id, user_id)
  WHERE resolved_at IS NULL;

CREATE INDEX knowledge_outdated_reports_open_count_idx
  ON knowledge_outdated_reports (knowledge_id)
  WHERE resolved_at IS NULL;
