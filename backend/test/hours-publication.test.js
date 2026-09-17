import test from "node:test";
import assert from "node:assert/strict";
import { createFacility, normalizeAlias, publishSchedule } from "../src/services/hours-publication.services.js";
import { validSchedule } from "./helpers/hours-fixtures.js";

function fakeDatabase(options = {}) {
  const calls = [];
  let nextId = 100;
  const client = {
    released: false,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (options.failOn && sql.includes(options.failOn)) throw new Error("database failure");
      if (sql.includes("SELECT id FROM facilities")) return { rowCount: options.facilityMissing ? 0 : 1, rows: [{ id: 1 }] };
      if (sql.includes("INSERT INTO facilities")) return { rows: [{ id: 1, name: params[0], active: true }] };
      if (sql.includes("INSERT INTO facility_schedules")) return { rows: [{ id: 50, published_at: new Date("2026-09-16T12:00:00Z") }] };
      if (sql.includes("RETURNING id")) return { rows: [{ id: nextId++ }] };
      return { rows: [], rowCount: 0 };
    },
    release() { this.released = true; },
  };
  return { calls, client, connect: async () => client };
}

test("normalizes aliases without unsafe substring transformations", () => {
  assert.equal(normalizeAlias("  ULM’s  Activity-Center! "), "ulms activity center");
});

test("creates a facility and de-duplicates aliases", async () => {
  const database = fakeDatabase();
  const result = await createFacility({ name: "Activity Center", aliases: ["AC", "ac"] }, database);
  assert.deepEqual(result.aliases, ["Activity Center", "ac"]);
  assert.equal(database.calls.filter(call => call.sql.startsWith("INSERT INTO facility_aliases")).length, 2);
  assert.equal(database.calls.at(-1).sql, "COMMIT");
  assert.equal(database.client.released, true);
});

test("validates before opening a publication transaction", async () => {
  let connected = false;
  const database = { connect: async () => { connected = true; } };
  const schedule = validSchedule();
  schedule.weekly = [];
  await assert.rejects(() => publishSchedule(schedule, database), error => error.status === 400);
  assert.equal(connected, false);
});

test("replaces a schedule atomically and commits only after its rules", async () => {
  const database = fakeDatabase();
  const result = await publishSchedule(validSchedule(), database);
  const statements = database.calls.map(call => call.sql);
  assert.equal(statements[0], "BEGIN");
  assert.ok(statements.indexOf("DELETE FROM facility_schedules WHERE facility_id = $1") < statements.findIndex(sql => sql.startsWith("INSERT INTO facility_schedules")));
  assert.equal(statements.at(-1), "COMMIT");
  assert.equal(result.scheduleId, 50);
  assert.equal(database.client.released, true);
});

test("rolls back a failed replacement and releases the connection", async () => {
  const database = fakeDatabase({ failOn: "INSERT INTO weekly_hours" });
  await assert.rejects(() => publishSchedule(validSchedule(), database), /database failure/);
  assert.equal(database.calls.at(-1).sql, "ROLLBACK");
  assert.equal(database.client.released, true);
});

test("does not delete anything when the facility is missing", async () => {
  const database = fakeDatabase({ facilityMissing: true });
  await assert.rejects(() => publishSchedule(validSchedule(), database), error => error.status === 404);
  assert.equal(database.calls.some(call => call.sql.startsWith("DELETE FROM facility_schedules")), false);
  assert.equal(database.calls.at(-1).sql, "ROLLBACK");
});

