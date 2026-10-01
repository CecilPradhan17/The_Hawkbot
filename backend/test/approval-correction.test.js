import test from "node:test";
import assert from "node:assert/strict";
import { processApproval } from "../src/services/approval.services.js";

const database = {
  async query(_text, params) {
    if (params[0] === 10) return { rows: [{ id: 10, content: "The corrected answer." }] };
    return { rows: [{ id: 20, content: "What is correct now?" }] };
  },
};

test("an approved correction answer links its first atomic fact to the stale fact", async () => {
  const links = [];
  const verifiedAt = new Date("2026-10-01T15:00:00.000Z");
  await processApproval(10, 20, {
    database,
    curator: async input => {
      assert.deepEqual(input, {
        type: "question",
        question: "What is correct now?",
        answer: "The corrected answer.",
      });
      return [{ content: "The corrected atomic fact.", reviewCategory: "yearly" }];
    },
    embeddingGenerator: async () => [0.1],
    correctionFinder: async (_db, questionId) => {
      assert.equal(questionId, 20);
      return { id: 5, knowledge_id: 8 };
    },
    replacementLinker: async (client, input) => links.push({ client, input }),
    storage: async options => {
      assert.equal(options.sourcePostId, 10);
      assert.equal(typeof options.afterStore, "function");
      await options.afterStore({ client: "transaction-client", stored: [{ id: 99 }], verifiedAt });
    },
  });

  assert.deepEqual(links, [{
    client: "transaction-client",
    input: {
      correctionId: 5,
      knowledgeId: 8,
      replacementKnowledgeId: 99,
      resolvedAt: verifiedAt,
    },
  }]);
});

test("an ordinary approved answer does not run replacement linking", async () => {
  let afterStore;
  let linked = false;
  await processApproval(10, 20, {
    database,
    curator: async () => [{ content: "An ordinary fact.", reviewCategory: "stable" }],
    embeddingGenerator: async () => [0.1],
    correctionFinder: async () => null,
    replacementLinker: async () => { linked = true; },
    storage: async options => { afterStore = options.afterStore; },
  });
  assert.equal(afterStore, null);
  assert.equal(linked, false);
});
