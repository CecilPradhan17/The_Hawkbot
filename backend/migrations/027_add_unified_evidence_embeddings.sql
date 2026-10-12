ALTER TABLE official_resources
  ADD COLUMN IF NOT EXISTS embedding VECTOR(3072);

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS embedding VECTOR(3072);

CREATE INDEX IF NOT EXISTS idx_official_resources_search
  ON official_resources USING GIN (to_tsvector('english', name || ' ' || description));

CREATE INDEX IF NOT EXISTS idx_facilities_search
  ON facilities USING GIN (to_tsvector('english', name || ' ' || description));

-- Embeddings cannot be generated in SQL. The application continues to use
-- full-text retrieval until the idempotent backfill script is run.
