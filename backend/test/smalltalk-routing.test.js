import test from "node:test";
import assert from "node:assert/strict";
import { handleChatQuery } from "../src/services/chatbot.services.js";

test("a greeting skips hours, embeddings, vector search, and the LLM", async () => {
  const fail = async () => { throw new Error("Downstream handler should not run"); };
  const result = await handleChatQuery("Hello!", {
    hoursHandler: fail,
    embedding: fail,
    database: { query: fail },
    polisher: fail,
  });
  assert.equal(result.matched, true);
  assert.equal(result.sourceType, "smalltalk");
  assert.match(result.response, /help|mind|ULM/i);
});

test("a greeting followed by a campus question continues downstream", async () => {
  const expected = { response: "The library closes at 10 PM.", matched: true, sourceType: "hours" };
  const result = await handleChatQuery("Hi, when does the library close?", {
    hoursHandler: async () => expected,
    embedding: async () => { throw new Error("Embedding should not run"); },
  });
  assert.equal(result, expected);
});
