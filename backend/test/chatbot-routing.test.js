import test from "node:test";
import assert from "node:assert/strict";
import { handleChatQuery } from "../src/services/chatbot.services.js";

test("a structured hours answer skips embedding, vector search, and polishing", async () => {
  const expected = { response: "Scheduled hours", matched: true, sourceType: "hours" };
  const fail = async () => { throw new Error("AI or RAG should not run"); };
  const result = await handleChatQuery("Is the AC open right now?", {
    hoursHandler: async () => expected,
    embedding: fail,
    database: { query: fail },
    polisher: fail,
  });
  assert.equal(result, expected);
});

test("an uncertain question falls through to the existing RAG flow", async () => {
  let embedded = false;
  let polished = false;
  const result = await handleChatQuery("Tell me about campus", {
    hoursHandler: async () => null,
    embedding: async () => { embedded = true; return [0.1, 0.2]; },
    database: { query: async () => ({ rows: [{ cleaned_content: "Verified fact", similarity: 0.9 }] }) },
    polisher: async () => { polished = true; return { answerable: true, response: "Helpful answer" }; },
  });
  assert.equal(embedded, true);
  assert.equal(polished, true);
  assert.equal(result.sourceType, "rag");
  assert.equal(result.response, "Helpful answer");
});

test("an unanswerable retrieved match uses the HawkWall fallback", async () => {
  const result = await handleChatQuery("Is dining open during Fall Break?", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    database: { query: async () => ({ rows: [{ cleaned_content: "Dining serves lunch daily", similarity: 0.9 }] }) },
    polisher: async () => ({ answerable: false, response: "" }),
  });
  assert.deepEqual(result, {
    response: "I don't have the answer to that yet. Try posting this question on the HawkWall and another student can answer you!",
    matched: false,
    sourceType: "fallback",
  });
});

test("the original honest fallback remains when RAG has no confident match", async () => {
  const result = await handleChatQuery("Unknown question", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    database: { query: async () => ({ rows: [] }) },
    polisher: async () => { throw new Error("Polisher should not run"); },
  });
  assert.equal(result.matched, false);
  assert.equal(result.sourceType, "fallback");
  assert.equal(
    result.response,
    "I don't have the answer to that yet. Try posting this question on the HawkWall and another student can answer you!",
  );
});
