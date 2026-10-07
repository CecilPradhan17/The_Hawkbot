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
        return { rows: [{ id: 100 + inserts }] };
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
  assert.equal(calls[1].params[3], "first fact");
  assert.equal(calls[1].params[6], "stable");
  assert.ok(calls[1].params[7] instanceof Date);
  assert.equal(calls[1].params[8], null);
  assert.equal(calls[2].params[3], "second fact");
  assert.equal(calls[2].params[6], "yearly");
  assert.ok(calls[2].params[8]);
  assert.match(calls[1].text, /review_category/);
});

test("stores official provenance for administrator-seeded knowledge", async () => {
  const { db, calls } = createDb();
  await storeApprovedKnowledge({
    db,
    sourcePostId: null,
    sourceUrl: "https://www.ulm.edu/registrar/",
    sourceTitle: "ULM Registrar",
    rawContent: "Registrar fact",
    chunks: [{ content: "Registrar fact", reviewCategory: "yearly" }],
    generateEmbedding: async () => [0.1],
  });
  assert.equal(calls[1].params[1], "https://www.ulm.edu/registrar/");
  assert.equal(calls[1].params[2], "ULM Registrar");
  assert.match(calls[1].text, /source_url, source_title/);
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

test("runs replacement linking inside the storage transaction", async () => {
  const { db, calls } = createDb();
  let callbackClient;

  const stored = await storeApprovedKnowledge({
    db,
    sourcePostId: 42,
    chunks: [{ content: "replacement fact", reviewCategory: "yearly" }],
    generateEmbedding: async () => [0.1],
    afterStore: async ({ client, stored: inserted }) => {
      callbackClient = client;
      assert.deepEqual(inserted, [{ id: 101, content: "replacement fact", reviewCategory: "yearly" }]);
      await client.query("UPDATE correction link");
    },
  });

  assert.ok(callbackClient);
  assert.deepEqual(stored, [{ id: 101, content: "replacement fact", reviewCategory: "yearly" }]);
  assert.deepEqual(calls.slice(-3).map(({ text }) => text), ["UPDATE correction link", "COMMIT", "RELEASE"]);
});

test("rolls back inserted facts when replacement linking fails", async () => {
  const { db, calls } = createDb();
  await assert.rejects(
    storeApprovedKnowledge({
      db,
      sourcePostId: 42,
      chunks: [{ content: "replacement fact", reviewCategory: "yearly" }],
      generateEmbedding: async () => [0.1],
      afterStore: async () => { throw new Error("link failed"); },
    }),
    /link failed/,
  );
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
});
