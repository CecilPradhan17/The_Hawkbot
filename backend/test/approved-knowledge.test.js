import test from "node:test";
import assert from "node:assert/strict";
import { storeApprovedKnowledge } from "../src/services/approved-knowledge.services.js";

const createDb = ({ failOnInsert = 0 } = {}) => {
  const calls = [];
  let inserts = 0;
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("INSERT")) {
        inserts += 1;
        if (inserts === failOnInsert) throw new Error("insert failed");
      }
      return { rows: [] };
    },
    release() {
      calls.push({ text: "RELEASE" });
    },
  };

  return { db: { async connect() { return client; } }, calls };
};

test("stores every atomic fact in one committed transaction", async () => {
  const { db, calls } = createDb();

  await storeApprovedKnowledge({
    db,
    sourcePostId: 42,
    chunks: [
      { content: "first fact", reviewCategory: "stable" },
      { content: "second fact", reviewCategory: "yearly" },
    ],
    generateEmbedding: async (text) => [text.length],
  });

  assert.deepEqual(calls.map(({ text }) => text.trim().split(/\s+/)[0]), [
    "BEGIN", "INSERT", "INSERT", "COMMIT", "RELEASE",
  ]);
  assert.equal(calls[1].params[0], 42);
  assert.equal(calls[1].params[1], "first fact");
  assert.equal(calls[1].params[4], "stable");
  assert.ok(calls[1].params[5] instanceof Date);
  assert.equal(calls[1].params[6], null);
  assert.equal(calls[2].params[1], "second fact");
  assert.equal(calls[2].params[4], "yearly");
  assert.ok(calls[2].params[6]);
  assert.match(calls[1].text, /review_category/);
});

test("rolls back all chunks when any insert fails", async () => {
  const { db, calls } = createDb({ failOnInsert: 2 });

  await assert.rejects(
    storeApprovedKnowledge({
      db,
      sourcePostId: 42,
      chunks: [
        { content: "first fact", reviewCategory: "stable" },
        { content: "second fact", reviewCategory: "yearly" },
      ],
      generateEmbedding: async () => [0.1],
    }),
    /insert failed/
  );

  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
});

test("does not open a transaction when embedding generation fails", async () => {
  const { db, calls } = createDb();

  await assert.rejects(
    storeApprovedKnowledge({
      db,
      sourcePostId: 42,
      chunks: [{ content: "first fact", reviewCategory: "stable" }],
      generateEmbedding: async () => { throw new Error("embedding failed"); },
    }),
    /embedding failed/
  );

  assert.equal(calls.length, 0);
});
