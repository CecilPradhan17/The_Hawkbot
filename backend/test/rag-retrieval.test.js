import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RAG_CANDIDATE_LIMIT,
  RAG_SOURCE_POOL_LIMIT,
  isConfidentCandidate,
  retrieveKnowledgeCandidates,
} from "../src/services/rag-retrieval.services.js";

test("fuses exact vector and full-text candidates into a ten-result pool", async () => {
  let captured;
  const rows = [{ id: 1, cleaned_content: "Fact", similarity: 0.9 }];
  const result = await retrieveKnowledgeCandidates([0.1, 0.2], "Where is the SSC?", {
    database: {
      query: async (text, values) => {
        captured = { text, values };
        return { rows };
      },
    },
  });

  assert.equal(result, rows);
  assert.equal(RAG_CANDIDATE_LIMIT, 10);
  assert.equal(RAG_SOURCE_POOL_LIMIT, 20);
  assert.deepEqual(captured.values, [JSON.stringify([0.1, 0.2]), "Where is the SSC?", 20, 10]);
  assert.match(captured.text, /WHERE embedding IS NOT NULL/);
  assert.match(captured.text, /ORDER BY \(embedding <=> \$1::vector\) \+ 0/);
  assert.match(captured.text, /websearch_to_tsquery\('english', \$2\)/);
  assert.match(captured.text, /to_tsvector\('english'/);
  assert.match(captured.text, /FULL OUTER JOIN text_ranked/);
  assert.match(captured.text, /retrieval_score/);
  assert.match(captured.text, /LIMIT \$4/);
  assert.match(captured.text, /source_post_id/);
  assert.match(captured.text, /approved_at/);
});

test("allows a smaller candidate limit for diagnostics", async () => {
  let values;
  await retrieveKnowledgeCandidates([0.5], "diagnostic", {
    limit: 4,
    sourceLimit: 8,
    database: { query: async (_text, params) => { values = params; return { rows: [] }; } },
  });
  assert.deepEqual(values.slice(1), ["diagnostic", 8, 4]);
});

test("accepts either a strong vector match or a full-text match", () => {
  assert.equal(isConfidentCandidate({ similarity: 0.7, text_rank: null }), true);
  assert.equal(isConfidentCandidate({ similarity: 0.2, text_rank: "1" }), true);
  assert.equal(isConfidentCandidate({ similarity: 0.2, text_rank: null }), false);
});

test("provides a concurrent GIN index for the full-text retrieval expression", () => {
  const migration = readFileSync(
    new URL("../migrations/016_add_approved_knowledge_full_text_index.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE INDEX CONCURRENTLY IF NOT EXISTS approved_knowledge_full_text_idx/);
  assert.match(migration, /USING GIN/);
  assert.match(migration, /to_tsvector/);
  assert.match(migration, /COALESCE\(cleaned_content, ''\)/);
  assert.match(migration, /COALESCE\(raw_content, ''\)/);
});
