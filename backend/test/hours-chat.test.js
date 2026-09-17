import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { tryHandleHoursQuery } from "../src/services/hours-chat.services.js";
import { validSchedule } from "./helpers/hours-fixtures.js";

const now = DateTime.fromISO("2026-09-16T10:00:00", { zone: "America/Chicago" });
const dictionary = async () => [{ id: 1, name: "Activity Center", normalized_alias: "ac" }];
const schedule = async () => ({ ...validSchedule(), facilityName: "Activity Center", publishedAt: new Date() });

test("handles a recognized hours question and records avoided AI calls", async () => {
  const recorded = [];
  const result = await tryHandleHoursQuery("What are the AC hours today?", {
    dictionary, scheduleReader: schedule, now,
    metrics: async columns => recorded.push(columns),
  });
  assert.equal(result.sourceType, "hours");
  assert.deepEqual(recorded[0], ["structured_hits", "embedding_calls_avoided", "llm_calls_avoided"]);
});

test("returns null for uncertain wording so existing RAG can handle it", async () => {
  const result = await tryHandleHoursQuery("How close is the AC to the library?", {
    dictionary, scheduleReader: schedule, now, metrics: async () => {},
  });
  assert.equal(result, null);
});

