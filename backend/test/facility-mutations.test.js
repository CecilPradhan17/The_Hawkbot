import test from "node:test";
import assert from "node:assert/strict";
import { deleteFacility, updateFacility } from "../src/services/hours-publication.services.js";

function updateDatabase({ missing = false, failOnAlias = false } = {}) {
  const calls = [];
  const client = {
    released: false,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, params });
      if (failOnAlias && normalized.startsWith("INSERT INTO facility_aliases")) {
        throw new Error("alias failure");
      }
      if (normalized.startsWith("UPDATE facilities")) {
        return missing
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ id: params[1], name: params[0], active: true }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() { this.released = true; },
  };
  return { calls, client, connect: async () => client };
}

test("updates a facility and replaces aliases without changing its schedule", async () => {
  const database = updateDatabase();
  const result = await updateFacility(4, { name: "Activity Center", aliases: ["AC", "The AC"] }, database);
  assert.deepEqual(result.aliases, ["Activity Center", "AC", "The AC"]);
  assert.equal(database.calls[0].sql, "BEGIN");
  assert.deepEqual(database.calls[1].params, ["Activity Center", 4]);
  assert.equal(database.calls.some(call => call.sql.includes("facility_schedules")), false);
  assert.equal(database.calls.at(-1).sql, "COMMIT");
  assert.equal(database.client.released, true);
});

test("rolls back a failed facility edit", async () => {
  const database = updateDatabase({ failOnAlias: true });
  await assert.rejects(
    () => updateFacility(4, { name: "Activity Center", aliases: ["AC"] }, database),
    /alias failure/
  );
  assert.equal(database.calls.at(-1).sql, "ROLLBACK");
  assert.equal(database.client.released, true);
});

test("returns not found when editing a missing facility", async () => {
  const database = updateDatabase({ missing: true });
  await assert.rejects(
    () => updateFacility(999, { name: "Missing", aliases: [] }, database),
    error => error.status === 404
  );
  assert.equal(database.calls.some(call => call.sql.startsWith("DELETE FROM facility_aliases")), false);
  assert.equal(database.calls.at(-1).sql, "ROLLBACK");
});

test("deletes a facility with one parameterized statement", async () => {
  const calls = [];
  const database = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 1, rows: [{ id: 4 }] };
    },
  };
  await deleteFacility(4, database);
  assert.match(calls[0].sql, /^DELETE FROM facilities/);
  assert.deepEqual(calls[0].params, [4]);
});

test("returns not found when deleting a missing facility", async () => {
  const database = { query: async () => ({ rowCount: 0, rows: [] }) };
  await assert.rejects(() => deleteFacility(999, database), error => error.status === 404);
});
