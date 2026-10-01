import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCorrectionQuestionContent,
  createCorrectionQuestion,
  findOpenCorrectionForQuestion,
  linkCorrectionReplacement,
} from "../src/services/knowledge-correction.services.js";

test("builds a normal correction question within the post limit", () => {
  const content = buildCorrectionQuestionContent("A".repeat(400));
  assert.ok(content.length <= 250);
  assert.match(content, /^Hawkbot needs an update\./);
  assert.match(content, /What is the current correct information\?$/);
  assert.ok(content.includes("…"));
});

test("creates one linked Hawkbot question", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("FROM knowledge_correction_questions")) return { rowCount: 0, rows: [] };
      if (text.includes("FROM users")) return { rowCount: 1, rows: [{ id: 90 }] };
      if (text.includes("INSERT INTO posts")) return { rowCount: 1, rows: [{ id: 91 }] };
      return { rowCount: 1, rows: [] };
    },
  };
  const createdAt = new Date("2026-09-30T15:00:00.000Z");
  assert.deepEqual(
    await createCorrectionQuestion(client, { knowledgeId: 7, fact: "An old fact.", createdAt }),
    { created: true, postId: 91 },
  );
  const postInsert = calls.find(({ text }) => text.includes("INSERT INTO posts"));
  assert.match(postInsert.text, /'question'/);
  assert.deepEqual(postInsert.params.slice(1), [90, createdAt]);
  const linkInsert = calls.find(({ text }) => text.includes("INSERT INTO knowledge_correction_questions"));
  assert.deepEqual(linkInsert.params, [7, 91, createdAt]);
});

test("reuses an existing open correction instead of posting twice", async () => {
  const calls = [];
  const client = {
    async query(text) {
      calls.push(text);
      return { rowCount: 1, rows: [{ id: 4, question_post_id: 55 }] };
    },
  };
  assert.deepEqual(
    await createCorrectionQuestion(client, { knowledgeId: 7, fact: "An old fact." }),
    { created: false, postId: 55 },
  );
  assert.equal(calls.length, 1);
});

test("migration links one open correction question to a stale fact", () => {
  const migration = readFileSync(
    new URL("../migrations/021_add_knowledge_correction_questions.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE knowledge_correction_questions/);
  assert.match(migration, /question_post_id INTEGER NOT NULL UNIQUE REFERENCES posts/);
  assert.match(migration, /replacement_knowledge_id INTEGER REFERENCES approved_knowledge/);
  assert.match(migration, /knowledge_correction_questions_one_open_per_fact_idx/);
});

test("finds an open correction by its HawkWall question", async () => {
  const database = {
    async query(_text, params) {
      assert.deepEqual(params, [44]);
      return { rows: [{ id: 5, knowledge_id: 8 }] };
    },
  };
  assert.deepEqual(
    await findOpenCorrectionForQuestion(database, 44),
    { id: 5, knowledge_id: 8 },
  );
});

test("links the stale fact and resolves its correction", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return { rowCount: 1, rows: [{ id: 1 }] };
    },
  };
  const resolvedAt = new Date("2026-10-01T15:00:00.000Z");
  await linkCorrectionReplacement(client, {
    correctionId: 5,
    knowledgeId: 8,
    replacementKnowledgeId: 12,
    resolvedAt,
  });
  assert.match(calls[0].text, /status = 'replaced'/);
  assert.deepEqual(calls[0].params, [12, 8]);
  assert.match(calls[1].text, /status = 'resolved'/);
  assert.deepEqual(calls[1].params, [12, resolvedAt, 5]);
});

test("refuses to resolve a correction when the stale fact is unavailable", async () => {
  const client = { async query() { return { rowCount: 0, rows: [] }; } };
  await assert.rejects(
    linkCorrectionReplacement(client, {
      correctionId: 5,
      knowledgeId: 8,
      replacementKnowledgeId: 12,
      resolvedAt: new Date(),
    }),
    /not available for replacement/,
  );
});
