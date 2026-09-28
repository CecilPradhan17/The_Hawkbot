import test from "node:test";
import assert from "node:assert/strict";
import { normalizeKnowledgeChunks } from "../src/services/knowledge-curation.services.js";

test("keeps each curated fact as independent retrieval knowledge", () => {
  const chunks = normalizeKnowledgeChunks({
    chunks: [
      { fact: "The tutoring center is in Walker Hall.", reviewCategory: "stable" },
      { fact: "The tutoring center closes at 8:00 PM.", reviewCategory: "frequent" },
    ],
  });

  assert.deepEqual(chunks, [
    { content: "The tutoring center is in Walker Hall.", reviewCategory: "stable" },
    { content: "The tutoring center closes at 8:00 PM.", reviewCategory: "frequent" },
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
  assert.equal(chunks[0].reviewCategory, "frequent");
});

test("defaults an unsupported review category to frequent", () => {
  assert.deepEqual(normalizeKnowledgeChunks({
    chunks: [{ fact: "The Registrar processes transcripts.", reviewCategory: "sometimes" }],
  }), [{ content: "The Registrar processes transcripts.", reviewCategory: "frequent" }]);
});

test("rejects a non-array chunk payload", () => {
  assert.deepEqual(normalizeKnowledgeChunks({ chunks: "invalid" }), []);
});
