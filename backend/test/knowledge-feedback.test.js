import test from "node:test";
import assert from "node:assert/strict";
import { reportKnowledgeOutdated } from "../src/services/knowledge-feedback.services.js";

const fakeDatabase = ({ reportCount = 1, inserted = true } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id FROM approved_knowledge")) return { rowCount: 1, rows: [{ id: 7 }] };
      if (text.includes("INSERT INTO knowledge_outdated_reports")) return { rowCount: inserted ? 1 : 0, rows: inserted ? [{ id: 2 }] : [] };
      if (text.includes("COUNT(*)")) return { rows: [{ count: reportCount }] };
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("one outdated report does not queue an early review", async () => {
  const { database, calls } = fakeDatabase({ reportCount: 1 });
  const result = await reportKnowledgeOutdated({ userId: 3, knowledgeIds: [7] }, { database, threshold: 3 });
  assert.deepEqual(result, { reported: true, queued: false });
  assert.equal(calls.some(({ text }) => text.includes("SET review_due_at")), false);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("the approval threshold queues the fact for early verification", async () => {
  const { database, calls } = fakeDatabase({ reportCount: 3 });
  const result = await reportKnowledgeOutdated({ userId: 3, knowledgeIds: [7] }, { database, threshold: 3 });
  assert.deepEqual(result, { reported: true, queued: true });
  const update = calls.find(({ text }) => text.includes("SET review_due_at"));
  assert.match(update.text, /verification_requested_at IS NULL/);
  assert.deepEqual(update.params, [7]);
});

test("a repeated report by the same user is idempotent", async () => {
  const { database } = fakeDatabase({ inserted: false, reportCount: 1 });
  assert.deepEqual(
    await reportKnowledgeOutdated({ userId: 3, knowledgeIds: [7, 7] }, { database, threshold: 3 }),
    { reported: false, queued: false },
  );
});

test("unavailable facts roll back the report", async () => {
  const calls = [];
  const client = {
    async query(text) {
      calls.push(text);
      if (text.includes("SELECT id FROM approved_knowledge")) return { rowCount: 0, rows: [] };
      return { rows: [] };
    },
    release() { calls.push("RELEASE"); },
  };
  await assert.rejects(
    reportKnowledgeOutdated({ userId: 3, knowledgeIds: [7] }, { database: { async connect() { return client; } }, threshold: 3 }),
    /unavailable/,
  );
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", "RELEASE"]);
});
