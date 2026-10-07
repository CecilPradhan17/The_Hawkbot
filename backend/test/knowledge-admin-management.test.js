import test from "node:test";
import assert from "node:assert/strict";
import { correctKnowledgeForAdmin } from "../src/services/knowledge-admin-management.services.js";

const correctionHarness = ({ status = "active" } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id, status")) {
        return { rowCount: 1, rows: [{ id: 7, status }] };
      }
      if (text.includes("UPDATE knowledge_verifications")) {
        return { rows: [{ post_id: 30 }] };
      }
      if (text.includes("UPDATE knowledge_correction_questions")) {
        return { rows: [{ question_post_id: 40 }] };
      }
      return { rows: [] };
    },
  };
  const verifiedAt = new Date("2026-10-07T15:00:00Z");
  const storageCalls = [];
  const storage = async options => {
    storageCalls.push(options);
    await options.afterStore({
      client,
      stored: [{ id: 99, content: options.chunks[0].content, reviewCategory: options.chunks[0].reviewCategory }],
      verifiedAt,
    });
    return [{ id: 99, content: options.chunks[0].content, reviewCategory: options.chunks[0].reviewCategory }];
  };
  return { calls, storageCalls, storage, verifiedAt };
};

test("creates an embedded replacement and preserves an audit trail", async () => {
  const { calls, storageCalls, storage, verifiedAt } = correctionHarness();
  const embeddingGenerator = async () => [0.1];
  const result = await correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "  The Library opens at 7:30 AM.  ",
    reviewCategory: "term",
    note: "Updated from the current library notice.",
  }, { database: "database", embeddingGenerator, storage });

  assert.deepEqual(result, {
    replacedKnowledgeId: 7,
    replacement: { id: 99, content: "The Library opens at 7:30 AM.", reviewCategory: "term" },
  });
  assert.equal(storageCalls[0].db, "database");
  assert.equal(storageCalls[0].sourcePostId, null);
  assert.equal(storageCalls[0].rawContent, null);
  assert.equal(storageCalls[0].generateEmbedding, embeddingGenerator);
  assert.deepEqual(storageCalls[0].chunks, [{
    content: "The Library opens at 7:30 AM.",
    reviewCategory: "term",
  }]);

  const replace = calls.find(({ text }) => text.includes("SET status = 'replaced'"));
  assert.deepEqual(replace.params, [99, 7]);
  assert.equal(calls.filter(({ text }) => text.includes("UPDATE posts SET status = 'closed'")).length, 2);
  const correction = calls.find(({ text }) => text.includes("UPDATE knowledge_correction_questions"));
  assert.match(correction.text, /status = 'resolved'/);
  assert.match(correction.text, /replacement_knowledge_id = \$1/);
  assert.deepEqual(correction.params, [99, verifiedAt, 7]);
  const audit = calls.find(({ text }) => text.includes("INSERT INTO knowledge_admin_actions"));
  assert.deepEqual(audit.params, [7, 99, 3, "Updated from the current library notice.", verifiedAt]);
});

test("allows an administrator to replace knowledge already needing an update", async () => {
  const { storage } = correctionHarness({ status: "needs_update" });
  await assert.doesNotReject(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "The corrected fact.",
    reviewCategory: "yearly",
    note: "Corrected after community feedback.",
  }, { storage, embeddingGenerator: async () => [0.1] }));
});

test("refuses to replace historical knowledge", async () => {
  const { storage } = correctionHarness({ status: "replaced" });
  await assert.rejects(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "The corrected fact.",
    reviewCategory: "yearly",
    note: "Attempted historical edit.",
  }, { storage, embeddingGenerator: async () => [0.1] }), (error) => (
    error.status === 409 && error.message === "Only active or needs-update knowledge can be corrected"
  ));
});

test("validates corrections before generating embeddings or opening storage", async () => {
  let embedded = false;
  let stored = false;
  await assert.rejects(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "No",
    reviewCategory: "weekly",
    note: "",
  }, {
    embeddingGenerator: async () => { embedded = true; return [0.1]; },
    storage: async () => { stored = true; },
  }), /Corrected knowledge/);
  assert.equal(embedded, false);
  assert.equal(stored, false);
});
