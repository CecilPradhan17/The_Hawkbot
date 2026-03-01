DROP TABLE approved_knowledge;

CREATE TABLE approved_knowledge (
  id SERIAL PRIMARY KEY,
  source_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  cleaned_content TEXT NOT NULL,
  raw_content TEXT,
  embedding VECTOR(3072),
  approved_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON approved_knowledge 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);