import test from "node:test";
import assert from "node:assert/strict";
import { tryHandleSmalltalk } from "../src/services/smalltalk.services.js";

test("answers standalone greetings naturally", () => {
  const result = tryHandleSmalltalk("Hi!", () => 0);
  assert.deepEqual(result, {
    response: "Hey! What can I help you figure out around campus?",
    matched: true,
    sourceType: "smalltalk",
  });
});

test("answers wellbeing questions and combined greetings", () => {
  assert.equal(tryHandleSmalltalk("How are you?", () => 0.5).sourceType, "smalltalk");
  assert.equal(tryHandleSmalltalk("Hey, how's it going?", () => 0.75).matched, true);
});

test("does not swallow substantive questions that begin with a greeting", () => {
  assert.equal(tryHandleSmalltalk("Hi, when does the library close?"), null);
  assert.equal(tryHandleSmalltalk("Hello, what are the dining hours?"), null);
});
