ALTER TABLE approved_knowledge
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN review_category TEXT,
  ADD COLUMN last_verified_at TIMESTAMPTZ,
  ADD COLUMN review_due_at TIMESTAMPTZ,
  ADD COLUMN verification_requested_at TIMESTAMPTZ,
  ADD COLUMN superseded_by_id INTEGER;

ALTER TABLE approved_knowledge
  ADD CONSTRAINT approved_knowledge_status_check
    CHECK (status IN ('active', 'needs_update', 'replaced')),
  ADD CONSTRAINT approved_knowledge_review_category_check
    CHECK (review_category IS NULL OR review_category IN ('stable', 'yearly', 'term', 'frequent')),
  ADD CONSTRAINT approved_knowledge_superseded_by_fkey
    FOREIGN KEY (superseded_by_id)
    REFERENCES approved_knowledge(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT approved_knowledge_not_self_superseded
    CHECK (superseded_by_id IS NULL OR superseded_by_id <> id);

UPDATE approved_knowledge
SET last_verified_at = COALESCE(approved_at, NOW());

ALTER TABLE approved_knowledge
  ALTER COLUMN last_verified_at SET DEFAULT NOW(),
  ALTER COLUMN last_verified_at SET NOT NULL;

CREATE INDEX approved_knowledge_active_idx
  ON approved_knowledge (status)
  WHERE status = 'active';
