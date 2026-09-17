import test from "node:test";
import assert from "node:assert/strict";
import { getPublishedSchedule, incrementHoursMetrics } from "../src/services/hours-repository.services.js";

function scheduleDatabase() {
  let dataQuery = 0;
  const calls = [];
  const data = [
    { rowCount: 1, rows: [{ id: 10, facility_id: 1, facility_name: "Activity Center", coverage_start: "2026-08-17", coverage_end: "2026-12-18", source_label: "Fall", published_at: new Date() }] },
    { rows: [{ id: 20, weekday: 1, status: "open" }] },
    { rows: [{ weekly_hours_id: 20, opens_at: "08:00:00", closes_at: "17:00:00", closes_next_day: false }] },
    { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
  ];
  const client = {
    released: false,
    async query(sql) {
      calls.push(sql.replace(/\s+/g, " ").trim());
      if (sql.startsWith("BEGIN") || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      return data[dataQuery++];
    },
    release() { this.released = true; },
  };
  return { calls, client, connect: async () => client };
}

test("reads a complete schedule in one repeatable-read transaction", async () => {
  const database = scheduleDatabase();
  const schedule = await getPublishedSchedule(1, database);
  assert.equal(database.calls[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(database.calls.at(-1), "COMMIT");
  assert.equal(database.client.released, true);
  assert.deepEqual(schedule.weekly[0].intervals[0], { opensAt: "08:00", closesAt: "17:00", closesNextDay: false });
});

test("metrics use an allowlist and never interpolate arbitrary columns", async () => {
  const calls = [];
  const database = { query: async sql => { calls.push(sql); } };
  await incrementHoursMetrics(["structured_hits", "not_a_column"], database);
  assert.match(calls[0], /structured_hits/);
  assert.doesNotMatch(calls[0], /not_a_column/);
});

