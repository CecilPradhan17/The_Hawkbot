import test from "node:test";
import assert from "node:assert/strict";
import { RAG_CANDIDATE_LIMIT, retrieveKnowledgeCandidates } from "../src/services/rag-retrieval.services.js";

test("retrieves ten candidates with an exact cosine scan", async () => {
  let captured;
  const rows = [{ id: 1, cleaned_content: "Fact", similarity: 0.9 }];
  const result = await retrieveKnowledgeCandidates([0.1, 0.2], {
    database: {
      query: async (text, values) => {
        captured = { text, values };
        return { rows };
      },
    },
  });

  assert.equal(result, rows);
  assert.equal(RAG_CANDIDATE_LIMIT, 10);
  assert.deepEqual(captured.values, [JSON.stringify([0.1, 0.2]), 10]);
  assert.match(captured.text, /WHERE embedding IS NOT NULL/);
  assert.match(captured.text, /ORDER BY \(embedding <=> \$1::vector\) \+ 0/);
  assert.match(captured.text, /LIMIT \$2/);
  assert.match(captured.text, /source_post_id/);
  assert.match(captured.text, /approved_at/);
});

test("allows a smaller candidate limit for diagnostics", async () => {
  let values;
  await retrieveKnowledgeCandidates([0.5], {
    limit: 4,
    database: { query: async (_text, params) => { values = params; return { rows: [] }; } },
  });
  assert.equal(values[1], 4);
});
