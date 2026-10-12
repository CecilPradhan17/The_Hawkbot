-- Apply after running `npm run backfill:evidence`.
-- Prevent future migrations or write paths from activating knowledge without
-- the vector required for semantic retrieval.
ALTER TABLE approved_knowledge
  DROP CONSTRAINT IF EXISTS approved_knowledge_active_embedding_check;

ALTER TABLE approved_knowledge
  ADD CONSTRAINT approved_knowledge_active_embedding_check
  CHECK (status <> 'active' OR embedding IS NOT NULL) NOT VALID;

ALTER TABLE approved_knowledge
  VALIDATE CONSTRAINT approved_knowledge_active_embedding_check;
