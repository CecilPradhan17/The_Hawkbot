import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { parseTargetDate } from "../src/services/hours-query.services.js";

const now = DateTime.fromISO("2026-09-16T10:00:00", { zone: "America/Chicago" });

test("parses common relative-date phrases in precedence order", () => {
  assert.equal(parseTargetDate("hours tmrw", now).toISODate(), "2026-09-17");
  assert.equal(parseTargetDate("hours tomorrow", now).toISODate(), "2026-09-17");
  assert.equal(parseTargetDate("hours the day after tomorrow", now).toISODate(), "2026-09-18");
});

test("parses written dates and rolls a missing year forward", () => {
  assert.equal(parseTargetDate("hours September 20", now).toISODate(), "2026-09-20");
  assert.equal(parseTargetDate("hours September 15", now).toISODate(), "2027-09-15");
  assert.equal(parseTargetDate("hours September 15, 2025", now).toISODate(), "2025-09-15");
});
