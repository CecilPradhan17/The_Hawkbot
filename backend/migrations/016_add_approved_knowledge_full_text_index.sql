CREATE INDEX CONCURRENTLY IF NOT EXISTS approved_knowledge_full_text_idx
ON approved_knowledge
USING GIN (
  to_tsvector(
    'english',
    COALESCE(cleaned_content, '') || ' ' || COALESCE(raw_content, '')
  )
);
