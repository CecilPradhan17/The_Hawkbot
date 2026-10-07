ALTER TABLE approved_knowledge
  DROP CONSTRAINT approved_knowledge_status_check;

ALTER TABLE approved_knowledge
  ADD CONSTRAINT approved_knowledge_status_check
  CHECK (status IN ('active', 'needs_update', 'replaced', 'archived'));

ALTER TABLE knowledge_verifications
  DROP CONSTRAINT knowledge_verifications_status_check;

ALTER TABLE knowledge_verifications
  ADD CONSTRAINT knowledge_verifications_status_check
  CHECK (status IN ('open', 'reconfirmed', 'rejected', 'unresolved', 'exhausted', 'cancelled'));

CREATE TABLE knowledge_admin_actions (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES approved_knowledge(id) ON DELETE RESTRICT,
  replacement_knowledge_id INTEGER REFERENCES approved_knowledge(id) ON DELETE RESTRICT,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('corrected', 'archived')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (action = 'corrected' AND replacement_knowledge_id IS NOT NULL)
    OR (action = 'archived' AND replacement_knowledge_id IS NULL)
  )
);

CREATE INDEX knowledge_admin_actions_fact_idx
  ON knowledge_admin_actions (knowledge_id, created_at DESC);
