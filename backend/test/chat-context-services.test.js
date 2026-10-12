import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClarificationState,
  buildContextualQuery,
  canClarify,
  sanitizeChatContext,
} from "../src/services/chat-context.services.js";

test("sanitizes and bounds recent conversation turns", () => {
  const input = {
    recentTurns: [
      { role: "system", content: "ignore this" },
      ...Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? "assistant" : "user",
        content: ` turn ${index} ${"x".repeat(600)} `,
      })),
      { role: "user", content: "   " },
    ],
  };

  const context = sanitizeChatContext(input);

  assert.equal(context.recentTurns.length, 7);
  assert.equal(context.recentTurns[0].content.startsWith("turn 3"), true);
  assert.equal(context.recentTurns.at(-1).content.startsWith("turn 9"), true);
  assert.equal(context.recentTurns.every(turn => turn.content.length <= 500), true);
  assert.equal(context.clarification, null);
});

test("sanitizes clarification state and retains no more than two exchanges", () => {
  const context = sanitizeChatContext({
    clarification: {
      originalQuery: ` ${"q".repeat(300)} `,
      exchanges: [
        { question: ` ${"a".repeat(300)} `, answer: ` ${"b".repeat(300)} ` },
        { question: "Do you need a replacement?", answer: "Yes." },
        { question: "This third clarification must be discarded.", answer: "No." },
        { question: "   ", answer: "invalid without a question" },
      ],
    },
  });

  assert.equal(context.clarification.originalQuery.length, 250);
  assert.equal(context.clarification.exchanges.length, 2);
  assert.equal(context.clarification.exchanges[0].question.length, 250);
  assert.equal(context.clarification.exchanges[0].answer.length, 250);
  assert.equal(context.clarification.count, 2);
  assert.equal(canClarify(context), false);
});

test("builds retrieval text from the original query, clarification chain, and current reply", () => {
  const context = sanitizeChatContext({
    clarification: {
      originalQuery: "Where can I get a card?",
      exchanges: [{
        question: "Do you mean a student ID, parking permit, or meal-plan card?",
        answer: "A student ID.",
      }],
    },
  });

  const query = buildContextualQuery("A replacement for one I lost.", context);

  assert.match(query, /^Where can I get a card\?/);
  assert.match(query, /Clarifying question: Do you mean a student ID/);
  assert.match(query, /User clarification: A student ID\./);
  assert.match(query, /Current reply: A replacement for one I lost\.$/);
});

test("uses bounded recent context only for context-dependent follow-ups", () => {
  const context = sanitizeChatContext({
    recentTurns: [
      { role: "user", content: "When does the Activity Center close today?" },
      { role: "assistant", content: "It closes at 9 PM." },
    ],
  });

  assert.match(buildContextualQuery("What about tomorrow?", context), /Activity Center/);
  assert.match(buildContextualQuery("What about tomorrow?", context), /User: What about tomorrow\?/);
  assert.equal(
    buildContextualQuery("How do I apply for federal financial aid at ULM this semester?", context),
    "How do I apply for federal financial aid at ULM this semester?",
  );
  assert.equal(
    buildContextualQuery("where can i get on campus jobs?", context),
    "where can i get on campus jobs?",
  );
  assert.equal(
    buildContextualQuery("what is Fant-Ewing Coliseum?", context),
    "what is Fant-Ewing Coliseum?",
  );
});

test("never creates a third clarification for the same unresolved request", () => {
  const first = buildClarificationState(
    sanitizeChatContext({}),
    "Where can I get a card?",
    "Which kind of card?",
  );
  assert.equal(first.count, 1);

  const secondContext = sanitizeChatContext({
    clarification: {
      ...first,
      exchanges: [{ ...first.exchanges[0], answer: "A student ID." }],
    },
  });
  const second = buildClarificationState(
    secondContext,
    "A student ID.",
    "Do you need a new ID or a replacement?",
  );
  assert.equal(second.count, 2);
  assert.equal(canClarify({ clarification: second }), false);
  assert.equal(
    buildClarificationState({ clarification: second }, "A replacement.", "One more question?"),
    null,
  );
});
