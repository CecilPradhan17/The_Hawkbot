import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { readFileSync } from "node:fs";
import {
  buildVerificationPostContent,
  calculateNextReviewAt,
  createDueVerificationPosts,
} from "../src/services/knowledge-review.services.js";

test("calculates stable, yearly, and frequent review dates", () => {
  const verified = "2026-09-15T10:00:00-05:00";
  assert.equal(calculateNextReviewAt("stable", verified), null);
  assert.equal(calculateNextReviewAt("yearly", verified), "2027-09-15T15:00:00.000Z");
  assert.equal(calculateNextReviewAt("frequent", verified), "2026-12-14T16:00:00.000Z");
});

test("uses January and August term boundaries with a thirty-day minimum gap", () => {
  assert.equal(
    calculateNextReviewAt("term", "2026-11-01T12:00:00-06:00"),
    "2027-01-01T06:00:00.000Z",
  );
  assert.equal(
    calculateNextReviewAt("term", "2026-12-29T12:00:00-06:00"),
    "2027-08-01T05:00:00.000Z",
  );
  assert.equal(
    calculateNextReviewAt("term", "2026-07-20T12:00:00-05:00"),
    "2027-01-01T06:00:00.000Z",
  );
});

test("builds verification text without an AI call", () => {
  assert.equal(
    buildVerificationPostContent("The SSC provides free tutoring."),
    "Hawkbot currently knows:\n“The SSC provides free tutoring.”\n\nIs this still accurate?",
  );
});

const createDatabase = () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("FROM users")) return { rowCount: 1, rows: [{ id: 900 }] };
      if (text.includes("COUNT(*)")) return { rows: [{ count: 0 }] };
      if (text.includes("FROM approved_knowledge k")) {
        return { rows: [
          { id: 11, cleaned_content: "The SSC provides free tutoring." },
          { id: 12, cleaned_content: "The Honors Lounge is in Strauss Hall." },
        ] };
      }
      if (text.includes("INSERT INTO posts")) {
        return { rows: [{ id: 1000 + calls.length, content: params[0], created_at: new Date() }] };
      }
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("creates due verification posts transactionally with one-week deadlines", async () => {
  const { database, calls } = createDatabase();
  const now = DateTime.fromISO("2026-09-28T09:00:00", { zone: "America/Chicago" });
  const created = await createDueVerificationPosts({ database, now, limit: 20 });

  assert.equal(created.length, 2);
  const dueQuery = calls.find(({ text }) => text.includes("FROM approved_knowledge k"));
  assert.equal(dueQuery.params[1], 5);
  assert.match(dueQuery.text, /k\.review_due_at <= \$1/);
  assert.match(dueQuery.text, /v\.status = 'open'/);
  assert.match(dueQuery.text, /FOR UPDATE OF k SKIP LOCKED/);
  assert.ok(calls.some(({ text }) => text.includes("pg_advisory_xact_lock")));
  const verificationInserts = calls.filter(({ text }) => text.includes("INSERT INTO knowledge_verifications"));
  assert.equal(verificationInserts.length, 2);
  assert.equal(
    verificationInserts[0].params[3].getTime() - verificationInserts[0].params[2].getTime(),
    7 * 24 * 60 * 60 * 1000,
  );
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("honors the daily cap across scheduler retries", async () => {
  const calls = [];
  const client = {
    async query(text) {
      calls.push(text);
      if (text.includes("FROM users")) return { rowCount: 1, rows: [{ id: 900 }] };
      if (text.includes("COUNT(*)")) return { rows: [{ count: 5 }] };
      if (text.includes("FROM approved_knowledge")) throw new Error("Due facts should not be queried");
      return { rows: [] };
    },
    release() { calls.push("RELEASE"); },
  };
  const result = await createDueVerificationPosts({
    database: { async connect() { return client; } },
    now: DateTime.fromISO("2026-09-28T17:00:00", { zone: "America/Chicago" }),
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls.slice(-2), ["COMMIT", "RELEASE"]);
});

test("keeps normal posts at 250 characters and allows longer verification posts", () => {
  const migration = readFileSync(
    new URL("../migrations/019_allow_verification_post_content.sql", import.meta.url),
    "utf8",
  );
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
  await assert.rejects(
    createDueVerificationPosts({ database: { async connect() { return client; } } }),
    /system account is missing/,
  );
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", "RELEASE"]);
});
