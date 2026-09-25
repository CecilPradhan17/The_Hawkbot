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
    chunks: ["first fact", "second fact"],
    generateEmbedding: async (text) => [text.length],
  });

  assert.deepEqual(calls.map(({ text }) => text.trim().split(/\s+/)[0]), [
    "BEGIN", "INSERT", "INSERT", "COMMIT", "RELEASE",
  ]);
  assert.deepEqual(calls[1].params, [42, "first fact", null, "[10]"]);
  assert.deepEqual(calls[2].params, [42, "second fact", null, "[11]"]);
});

test("rolls back all chunks when any insert fails", async () => {
  const { db, calls } = createDb({ failOnInsert: 2 });

  await assert.rejects(
    storeApprovedKnowledge({
      db,
      sourcePostId: 42,
      chunks: ["first fact", "second fact"],
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
      chunks: ["first fact"],
      generateEmbedding: async () => { throw new Error("embedding failed"); },
    }),
    /embedding failed/
  );

  assert.equal(calls.length, 0);
});
