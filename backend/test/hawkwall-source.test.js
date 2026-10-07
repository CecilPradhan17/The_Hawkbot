import test from "node:test";
import assert from "node:assert/strict";
import { getApprovedHawkWallSource } from "../src/services/hawkwall-source.services.js";

test("resolves an active knowledge source to its complete historical question thread", async () => {
  const queries = [];
  const database = {
    query: async (text, values) => {
      queries.push({ text, values });
      if (queries.length === 1) return { rows: [{ source_post_id: 52, thread_post_id: 40 }] };
      if (queries.length === 2) return { rows: [{ id: 40, type: "question", status: "approved" }] };
      return { rows: [
        { id: 52, parent_id: 40, type: "answer", status: "approved" },
        { id: 53, parent_id: 40, type: "answer", status: "disapproved" },
      ] };
    },
  };

  const result = await getApprovedHawkWallSource(52, 7, database);
  assert.equal(result.sourcePostId, 52);
  assert.equal(result.post.id, 40);
  assert.deepEqual(result.answers.map(answer => answer.id), [52, 53]);
  assert.match(queries[0].text, /knowledge\.status = 'active'/);
  assert.deepEqual(queries[0].values, [52]);
  assert.deepEqual(queries[1].values, [40, 7]);
});

test("does not expose a post that is not an active approved knowledge source", async () => {
  const result = await getApprovedHawkWallSource(999, 7, {
    query: async () => ({ rows: [] }),
  });
  assert.equal(result, null);
});
