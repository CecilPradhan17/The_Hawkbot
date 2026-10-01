import test from "node:test";
import assert from "node:assert/strict";
import { getKnowledgeForAdmin } from "../src/controllers/knowledge-admin.controllers.js";

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
