ALTER TABLE users
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX users_one_system_account_idx
  ON users (is_system)
  WHERE is_system = TRUE;

INSERT INTO users (email, username, password_hash, is_system)
VALUES (
  'hawkbot-system@internal.invalid',
  'Hawkbot',
  '$2b$10$L4LHd6DRjNST0JWzsrJNMOoUSVwuhZKua8OlUGH7eA6jNIzBlK0bG',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE posts
  DROP CONSTRAINT posts_type_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_type_check
  CHECK (type IN ('post', 'question', 'answer', 'verification'));

CREATE TABLE knowledge_verifications (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES approved_knowledge(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  cycle_started_at TIMESTAMPTZ NOT NULL,
  attempt_number SMALLINT NOT NULL CHECK (attempt_number IN (1, 2)),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reconfirmed', 'rejected', 'unresolved', 'exhausted')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  CHECK (closes_at > opened_at),
  CHECK (
    (status = 'open' AND resolved_at IS NULL)
    OR (status <> 'open' AND resolved_at IS NOT NULL)
  ),
  UNIQUE (knowledge_id, cycle_started_at, attempt_number)
);

CREATE UNIQUE INDEX knowledge_verifications_one_open_per_fact_idx
  ON knowledge_verifications (knowledge_id)
  WHERE status = 'open';

CREATE INDEX knowledge_verifications_open_deadline_idx
  ON knowledge_verifications (closes_at)
  WHERE status = 'open';
