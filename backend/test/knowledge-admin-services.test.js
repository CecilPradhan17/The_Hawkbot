import test from "node:test";
import assert from "node:assert/strict";
import {
  listKnowledgeForAdmin,
  queueKnowledgeReview,
  updateKnowledgeReviewCategory,
} from "../src/services/knowledge-admin.services.js";

test("lists knowledge with pagination metadata", async () => {
  const calls = [];
  const database = {
    async query(text, params) {
      calls.push({ text, params });
      return {
        rows: [
          {
            id: 12,
            content: "The Activity Center is open from 6:00 AM to 9:00 PM on Mondays.",
            status: "active",
            total_count: 3,
          },
        ],
      };
    },
  };

  const result = await listKnowledgeForAdmin(
    { status: "active", limit: 20, offset: 10 },
    database,
  );

  assert.deepEqual(result, {
    items: [
      {
        id: 12,
        content: "The Activity Center is open from 6:00 AM to 9:00 PM on Mondays.",
        status: "active",
      },
    ],
    total: 3,
    limit: 20,
    offset: 10,
  });
  assert.deepEqual(calls[0].params, ["active", "", 20, 10]);
  assert.match(calls[0].text, /knowledge_verifications/);
  assert.match(calls[0].text, /knowledge_correction_questions/);
});

test("rejects unsupported knowledge statuses before querying", async () => {
  let queried = false;
  const database = {
    async query() {
      queried = true;
      return { rows: [] };
    },
  };

  await assert.rejects(
    listKnowledgeForAdmin({ status: "deleted" }, database),
    (error) => error.status === 400 && error.message === "Invalid knowledge status",
  );
  assert.equal(queried, false);
});

test("caps the page size and prevents negative offsets", async () => {
  let params;
  const database = {
    async query(_text, queryParams) {
      params = queryParams;
      return { rows: [] };
    },
  };

  const result = await listKnowledgeForAdmin(
    { status: "all", limit: 1000, offset: -5 },
    database,
  );

  assert.deepEqual(params, ["all", "", 100, 0]);
  assert.deepEqual(result, { items: [], total: 0, limit: 100, offset: 0 });
});

test("searches indexed fact and raw text with a bounded query", async () => {
  let call;
  const database = {
    async query(text, params) {
      call = { text, params };
      return { rows: [] };
    },
  };

  await listKnowledgeForAdmin(
    { status: "active", search: `  ${"library ".repeat(40)}  `, limit: 25 },
    database,
  );

  assert.match(call.text, /websearch_to_tsquery/);
  assert.match(call.text, /COALESCE\(k\.raw_content/);
  assert.equal(call.params[0], "active");
  assert.equal(call.params[1].length, 200);
  assert.equal(call.params[1].startsWith("library"), true);
  assert.deepEqual(call.params.slice(2), [25, 0]);
});

const categoryUpdateDatabase = ({ status = "active", found = true } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id, status")) {
        return found
          ? { rowCount: 1, rows: [{ id: 7, status, last_verified_at: new Date("2026-09-01T15:00:00Z") }] }
          : { rowCount: 0, rows: [] };
      }
      if (text.includes("UPDATE approved_knowledge")) {
        return {
          rowCount: 1,
          rows: [{ id: 7, review_category: params[0], review_due_at: params[1] }],
        };
      }
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("updates a review category and recalculates an active fact's due date", async () => {
  const { database, calls } = categoryUpdateDatabase();
  const result = await updateKnowledgeReviewCategory(7, "yearly", database);

  assert.equal(result.review_category, "yearly");
  assert.equal(result.review_due_at, "2027-09-01T15:00:00.000Z");
  const update = calls.find(({ text }) => text.includes("UPDATE approved_knowledge"));
  assert.deepEqual(update.params, ["yearly", "2027-09-01T15:00:00.000Z", 7]);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("keeps the due date empty for facts that already need correction", async () => {
  const { database, calls } = categoryUpdateDatabase({ status: "needs_update" });
  await updateKnowledgeReviewCategory(7, "frequent", database);

  const update = calls.find(({ text }) => text.includes("UPDATE approved_knowledge"));
  assert.deepEqual(update.params, ["frequent", null, 7]);
});

test("rejects invalid category updates before opening a transaction", async () => {
  let connected = false;
  const database = { async connect() { connected = true; } };

  await assert.rejects(
    updateKnowledgeReviewCategory(7, "weekly", database),
    (error) => error.status === 400 && error.message === "Invalid review category",
  );
  assert.equal(connected, false);
});

test("rolls back category updates when the fact does not exist", async () => {
  const { database, calls } = categoryUpdateDatabase({ found: false });

  await assert.rejects(
    updateKnowledgeReviewCategory(99, "stable", database),
    (error) => error.status === 404 && error.message === "Knowledge fact not found",
  );
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
});

const reviewQueueDatabase = ({ status = "active", hasOpenVerification = false } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT k.id, k.status")) {
        return {
          rowCount: 1,
          rows: [{ id: 7, status, has_open_verification: hasOpenVerification }],
        };
      }
      if (text.includes("UPDATE approved_knowledge")) {
        return { rows: [{ id: 7, review_due_at: new Date("2026-10-06T14:00:00Z") }] };
      }
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("queues an active fact for the next verification run", async () => {
  const { database, calls } = reviewQueueDatabase();
  const result = await queueKnowledgeReview(7, database);

  assert.deepEqual(result, {
    id: 7,
    reviewDueAt: new Date("2026-10-06T14:00:00Z"),
    queued: true,
    alreadyOpen: false,
  });
  const update = calls.find(({ text }) => text.includes("UPDATE approved_knowledge"));
  assert.match(update.text, /review_due_at = NOW\(\)/);
  assert.match(update.text, /verification_requested_at = NULL/);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("does not queue a duplicate when verification is already open", async () => {
  const { database, calls } = reviewQueueDatabase({ hasOpenVerification: true });
  const result = await queueKnowledgeReview(7, database);

  assert.deepEqual(result, { id: 7, queued: false, alreadyOpen: true });
  assert.equal(calls.some(({ text }) => text.includes("UPDATE approved_knowledge")), false);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("refuses to queue inactive knowledge", async () => {
  const { database, calls } = reviewQueueDatabase({ status: "needs_update" });

  await assert.rejects(
    queueKnowledgeReview(7, database),
    (error) => error.status === 409 && error.message === "Only active knowledge can be reviewed",
  );
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
});
