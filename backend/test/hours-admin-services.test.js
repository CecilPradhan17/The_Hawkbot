import test from "node:test";
import assert from "node:assert/strict";
import { listFacilities } from "../src/services/hours-admin.services.js";

test("lists facilities with aliases and optional current schedule summaries", async () => {
  const database = { query: async () => ({ rows: [
    {
      id: 1, name: "Activity Center", active: true, aliases: ["AC", "Activity Center"],
      coverage_start: "2026-08-17", coverage_end: "2026-12-18",
      source_label: "Fall 2026", published_at: new Date("2026-08-01T12:00:00Z"),
    },
    {
      id: 2, name: "Library", active: true, aliases: ["Library"],
      coverage_start: null, coverage_end: null, source_label: null, published_at: null,
    },
  ] }) };
  const facilities = await listFacilities(database);
  assert.equal(facilities[0].schedule.coverageStart, "2026-08-17");
  assert.equal(facilities[1].schedule, null);
});
