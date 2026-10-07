import test from "node:test";
import assert from "node:assert/strict";
import {
  editKnowledgeReviewCategory,
  getKnowledgeForAdmin,
  requestKnowledgeReview,
} from "../src/controllers/knowledge-admin.controllers.js";

test("knowledge admin controller forwards database errors", async () => {
  const nextCalls = [];

  await getKnowledgeForAdmin(
    { query: { status: "invalid" } },
    { json() { throw new Error("response should not be sent"); } },
    (error) => nextCalls.push(error),
  );

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0].status, 400);
  assert.equal(nextCalls[0].message, "Invalid knowledge status");
});

test("category controller forwards invalid update requests", async () => {
  const nextCalls = [];

  await editKnowledgeReviewCategory(
    { params: { knowledgeId: "7" }, body: { reviewCategory: "weekly" } },
    { json() { throw new Error("response should not be sent"); } },
    (error) => nextCalls.push(error),
  );

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0].status, 400);
  assert.equal(nextCalls[0].message, "Invalid review category");
});

test("review controller forwards invalid knowledge IDs", async () => {
  const nextCalls = [];

  await requestKnowledgeReview(
    { params: { knowledgeId: "not-an-id" } },
    { json() { throw new Error("response should not be sent"); } },
    (error) => nextCalls.push(error),
  );

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0].status, 400);
  assert.equal(nextCalls[0].message, "Invalid knowledge ID");
});
