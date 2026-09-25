import test from "node:test";
import assert from "node:assert/strict";
import { normalizeKnowledgeChunks } from "../src/services/knowledge-curation.services.js";

test("keeps each curated fact as independent retrieval knowledge", () => {
  const chunks = normalizeKnowledgeChunks({
    chunks: [
      { fact: "The tutoring center is in Walker Hall." },
      { fact: "The tutoring center closes at 8:00 PM." },
    ],
  });

  assert.deepEqual(chunks, [
    "The tutoring center is in Walker Hall.",
    "The tutoring center closes at 8:00 PM.",
  ]);
});

test("drops malformed and duplicate chunks", () => {
  const chunks = normalizeKnowledgeChunks({
    chunks: [
      { fact: "The Activity Center (AC) is on Warhawk Way." },
      { fact: "The Activity Center (AC) is on Warhawk Way." },
      { fact: "" },
      { unrelated: "invalid" },
    ],
  });

  assert.equal(chunks.length, 1);
});

test("rejects a non-array chunk payload", () => {
  assert.deepEqual(normalizeKnowledgeChunks({ chunks: "invalid" }), []);
});
