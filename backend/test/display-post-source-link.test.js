import test from "node:test";
import assert from "node:assert/strict";
import { displayOnePostFromDB } from "../src/services/displayPost.services.js";

test("direct links can open an approved question and its complete moderated thread", async () => {
  const queries = [];
  const database = {
    query: async (text, values) => {
      queries.push({ text, values });
      return queries.length === 1
        ? { rows: [{ id: 40, type: "question", status: "approved" }] }
        : { rows: [{ id: 52, type: "answer", status: "approved" }, { id: 53, type: "answer", status: "disapproved" }] };
    },
  };

  const result = await displayOnePostFromDB(40, 7, database);
  assert.equal(result.post.id, 40);
  assert.deepEqual(result.answers.map(answer => answer.id), [52, 53]);
  assert.match(queries[0].text, /p\.status IN \('pending', 'approved'\)/);
  assert.match(queries[1].text, /p\.status IN \('pending', 'approved', 'disapproved'\)/);
  assert.deepEqual(queries[0].values, [40, 7]);
});
