import test from "node:test";
import assert from "node:assert/strict";
import { findRelevantRank, summarizeRetrievalEvaluation } from "../src/services/rag-evaluation.services.js";

test("finds the first candidate containing any accepted answer phrase", () => {
  const rank = findRelevantRank(
    { expectedAny: ["official transcript requests", "registrar transcript"] },
    [
      { cleaned_content: "The library lends books." },
      { cleaned_content: "The Registrar processes official transcript requests." },
    ],
  );
  assert.equal(rank, 2);
});

test("checks raw source content as well as cleaned atomic facts", () => {
  const rank = findRelevantRank(
    { expectedAny: ["safety escort"] },
    [{ cleaned_content: "Campus police can assist students.", raw_content: "ULMPD offers a safety escort." }],
  );
  assert.equal(rank, 1);
});

test("returns zero when retrieval misses every accepted phrase", () => {
  assert.equal(findRelevantRank(
    { expectedAny: ["private study rooms"] },
    [{ cleaned_content: "The library lends books." }],
  ), 0);
});

test("calculates top-k accuracy, reciprocal rank, and failures", () => {
  const summary = summarizeRetrievalEvaluation([
    { query: "one", rank: 1 },
    { query: "two", rank: 3 },
    { query: "three", rank: 7 },
    { query: "miss", rank: 0 },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.top1, 0.25);
  assert.equal(summary.top3, 0.5);
  assert.equal(summary.top10, 0.75);
  assert.equal(summary.mrr, (1 + 1 / 3 + 1 / 7) / 4);
  assert.deepEqual(summary.failures, [{ query: "miss", rank: 0 }]);
});

test("handles an empty evaluation without dividing by zero", () => {
  assert.deepEqual(summarizeRetrievalEvaluation([]), {
    total: 0, top1: 0, top3: 0, top10: 0, mrr: 0, failures: [],
  });
});
