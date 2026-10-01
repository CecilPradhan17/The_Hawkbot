import test from "node:test";
import assert from "node:assert/strict";
import { listKnowledgeForAdmin } from "../src/services/knowledge-admin.services.js";

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
  assert.deepEqual(calls[0].params, ["active", 20, 10]);
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

  assert.deepEqual(params, ["all", 100, 0]);
  assert.deepEqual(result, { items: [], total: 0, limit: 100, offset: 0 });
});
