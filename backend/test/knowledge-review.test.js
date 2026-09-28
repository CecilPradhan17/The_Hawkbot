import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { readFileSync } from "node:fs";
import {
  buildVerificationPostContent,
  calculateNextReviewAt,
  createDueVerificationPosts,
  resolveExpiredVerifications,
  resolveVerificationOutcome,
  runKnowledgeReview,
} from "../src/services/knowledge-review.services.js";

test("calculates stable, yearly, frequent, and term review dates", () => {
  const verified = "2026-09-15T10:00:00-05:00";
  assert.equal(calculateNextReviewAt("stable", verified), null);
  assert.equal(calculateNextReviewAt("yearly", verified), "2027-09-15T15:00:00.000Z");
  assert.equal(calculateNextReviewAt("frequent", verified), "2026-12-14T16:00:00.000Z");
  assert.equal(calculateNextReviewAt("term", "2026-11-01T12:00:00-06:00"), "2027-01-01T06:00:00.000Z");
  assert.equal(calculateNextReviewAt("term", "2026-12-29T12:00:00-06:00"), "2027-08-01T05:00:00.000Z");
  assert.equal(calculateNextReviewAt("term", "2026-07-20T12:00:00-05:00"), "2027-01-01T06:00:00.000Z");
});

test("builds verification text without an AI call", () => {
  assert.equal(
    buildVerificationPostContent("The SSC provides free tutoring."),
    "Hawkbot currently knows:\n“The SSC provides free tutoring.”\n\nIs this still accurate?",
  );
});

const schedulerDb = ({ dailyCount = 0, due = [] } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("FROM users")) return { rowCount: 1, rows: [{ id: 900 }] };
      if (text.includes("COUNT(*)")) return { rows: [{ count: dailyCount }] };
      if (text.includes("FROM approved_knowledge k")) return { rows: due };
      if (text.includes("INSERT INTO posts")) return { rows: [{ id: 1000 + calls.length, content: params[0] }] };
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("creates due verification posts transactionally with one-week deadlines", async () => {
  const due = [
    { id: 11, cleaned_content: "The SSC provides free tutoring." },
    { id: 12, cleaned_content: "The Honors Lounge is in Strauss Hall." },
  ];
  const { database, calls } = schedulerDb({ due });
  const now = DateTime.fromISO("2026-09-28T09:00:00", { zone: "America/Chicago" });
  assert.equal((await createDueVerificationPosts({ database, now, limit: 20 })).length, 2);
  const dueQuery = calls.find(({ text }) => text.includes("FROM approved_knowledge k"));
  assert.equal(dueQuery.params[1], 5);
  assert.match(dueQuery.text, /v\.status = 'open'/);
  assert.match(dueQuery.text, /FOR UPDATE OF k SKIP LOCKED/);
  const inserts = calls.filter(({ text }) => text.includes("INSERT INTO knowledge_verifications"));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].params[3].getTime() - inserts[0].params[2].getTime(), 7 * 86400000);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("honors the daily cap across scheduler retries", async () => {
  const { database, calls } = schedulerDb({ dailyCount: 5 });
  assert.deepEqual(await createDueVerificationPosts({ database }), []);
  assert.equal(calls.some(({ text }) => text.includes("FROM approved_knowledge k")), false);
});

test("keeps normal posts at 250 characters and allows longer verification posts", () => {
  const migration = readFileSync(new URL("../migrations/019_allow_verification_post_content.sql", import.meta.url), "utf8");
  assert.match(migration, /type = 'verification'.*char_length\(content\) <= 1000/s);
  assert.match(migration, /type <> 'verification'.*char_length\(content\) <= 250/s);
});

test("rolls back when the Hawkbot system account is missing", async () => {
  const calls = [];
  const client = {
    async query(text) {
      calls.push(text);
      if (text.includes("FROM users")) return { rowCount: 0, rows: [] };
      return { rows: [] };
    },
    release() { calls.push("RELEASE"); },
  };
  await assert.rejects(createDueVerificationPosts({ database: { async connect() { return client; } } }), /system account is missing/);
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", "RELEASE"]);
});

test("reconfirming refreshes the existing fact without creating knowledge", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("FROM knowledge_verifications v")) return { rowCount: 1, rows: [{ id: 41, knowledge_id: 7, review_category: "yearly" }] };
      return { rows: [] };
    },
  };
  const resolvedAt = new Date("2026-09-28T14:00:00.000Z");
  assert.equal(await resolveVerificationOutcome(client, 88, "approved", resolvedAt), true);
  const update = calls.find(({ text }) => text.includes("UPDATE approved_knowledge"));
  assert.deepEqual(update.params, [resolvedAt, "2027-09-28T14:00:00.000Z", 7]);
  assert.equal(calls.some(({ text }) => text.includes("INSERT INTO approved_knowledge")), false);
});

test("rejecting marks the fact as needing an update", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("FROM knowledge_verifications v")) return { rowCount: 1, rows: [{ id: 42, knowledge_id: 8, review_category: "term" }] };
      return { rows: [] };
    },
  };
  assert.equal(await resolveVerificationOutcome(client, 89, "disapproved"), true);
  const update = calls.find(({ text }) => text.includes("UPDATE approved_knowledge"));
  assert.match(update.text, /status = 'needs_update'/);
  assert.deepEqual(update.params, [8]);
});

const expiryDb = ({ attemptNumber, dailyCount = 0 }) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("FROM users")) return { rowCount: 1, rows: [{ id: 900 }] };
      if (text.includes("COUNT(*)")) return { rows: [{ count: dailyCount }] };
      if (text.includes("FROM knowledge_verifications v")) return { rows: [{
        id: 51, knowledge_id: 13, post_id: 71,
        cycle_started_at: new Date("2026-09-01T14:00:00.000Z"),
        attempt_number: attemptNumber,
        cleaned_content: "The SSC provides free tutoring.", review_category: "frequent",
      }] };
      if (text.includes("INSERT INTO posts")) return { rows: [{ id: 72 }] };
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("an unanswered first verification is reposted once for another week", async () => {
  const { database, calls } = expiryDb({ attemptNumber: 1 });
  const now = DateTime.fromISO("2026-09-28T09:00:00", { zone: "America/Chicago" });
  assert.deepEqual(await resolveExpiredVerifications({ database, now }), [{ knowledgeId: 13, status: "retried" }]);
  const resolution = calls.find(({ text }) => text.includes("SET status = $1, resolved_at"));
  assert.equal(resolution.params[0], "unresolved");
  const retry = calls.find(({ text }) => text.includes("INSERT INTO knowledge_verifications"));
  assert.match(retry.text, /2, 'open'/);
  assert.equal(retry.params[4].getTime() - retry.params[3].getTime(), 7 * 86400000);
});

test("an unanswered second verification stops reposting and schedules a later review", async () => {
  const { database, calls } = expiryDb({ attemptNumber: 2 });
  const now = DateTime.fromISO("2026-09-28T09:00:00", { zone: "America/Chicago" });
  assert.deepEqual(await resolveExpiredVerifications({ database, now }), [{ knowledgeId: 13, status: "exhausted" }]);
  assert.equal(calls.some(({ text }) => text.includes("INSERT INTO posts")), false);
  const update = calls.find(({ text }) => text.includes("UPDATE approved_knowledge"));
  assert.equal(update.params[0], "2026-12-27T15:00:00.000Z");
});

test("a full daily cap defers a first retry without closing it", async () => {
  const { database, calls } = expiryDb({ attemptNumber: 1, dailyCount: 5 });
  assert.deepEqual(await resolveExpiredVerifications({ database }), []);
  assert.equal(calls.some(({ text }) => text.includes("SET status = $1, resolved_at")), false);
});

test("the daily runner resolves expired attempts before creating due posts", async () => {
  const calls = [];
  const database = { name: "test database" };
  const now = DateTime.fromISO("2026-09-28T09:00:00", { zone: "America/Chicago" });
  const result = await runKnowledgeReview({
    database,
    now,
    expiredResolver: async options => {
      calls.push({ step: "expired", options });
      return [{ knowledgeId: 1, status: "retried" }];
    },
    duePostCreator: async options => {
      calls.push({ step: "due", options });
      return [{ knowledgeId: 2, post: { id: 20 } }];
    },
  });

  assert.deepEqual(calls.map(call => call.step), ["expired", "due"]);
  assert.equal(calls[0].options.database, database);
  assert.equal(calls[1].options.now, now);
  assert.deepEqual(result, {
    resolved: [{ knowledgeId: 1, status: "retried" }],
    created: [{ knowledgeId: 2, post: { id: 20 } }],
  });
});

test("the daily runner does not create posts if expiration handling fails", async () => {
  let creatorCalled = false;
  await assert.rejects(
    runKnowledgeReview({
      expiredResolver: async () => { throw new Error("expiration failed"); },
      duePostCreator: async () => { creatorCalled = true; },
    }),
    /expiration failed/,
  );
  assert.equal(creatorCalled, false);
});
