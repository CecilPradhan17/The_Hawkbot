import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionCurationSource } from "../src/services/knowledge-curation-prompt.services.js";

test("includes the question and answer while separating context from evidence", () => {
  const prompt = buildQuestionCurationSource({
    question: "Is the university open on Labor Day?",
    answer: "No.",
  });

  assert.match(prompt, /Question: "Is the university open on Labor Day\?"/);
  assert.match(prompt, /Answer: "No\."/);
  assert.match(prompt, /answer as the evidence/i);
  assert.match(prompt, /question only to identify the subject and scope/i);
  assert.match(prompt, /Never treat an assumption.*question as established fact/i);
});

test("requires common context-dependent answers to become self-contained", () => {
  const prompt = buildQuestionCurationSource({ question: "Where and when?", answer: "Tomorrow." });

  for (const fragment of ["Yes", "No", "Tomorrow", "At 5 PM", "In the library"]) {
    assert.match(prompt, new RegExp(`"${fragment}"`, "i"));
  }
  assert.match(prompt, /must never be stored as that fragment alone/i);
  assert.match(prompt, /do not invent a missing qualifier or calendar date/i);
});
