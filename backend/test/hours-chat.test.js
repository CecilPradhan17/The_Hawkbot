import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { getHoursToolContext, resolveHoursToolLookup, tryHandleHoursQuery } from "../src/services/hours-chat.services.js";
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

test("routes stored special-period names to their special hours", async () => {
  const specialSchedule = async () => {
    const value = await schedule();
    value.specialPeriods = [{
      name: "Fall Break", startDate: "2026-10-08", endDate: "2026-10-11",
      days: value.weekly.map(day => day.weekday === 4
        ? { weekday: 4, status: "open", intervals: [{ opensAt: "06:00", closesAt: "19:00", closesNextDay: false }] }
        : { weekday: day.weekday, status: "closed", intervals: [] }),
    }];
    return value;
  };
  const result = await tryHandleHoursQuery("Is the AC open during Fall Break?", {
    dictionary, scheduleReader: specialSchedule, now, metrics: async () => {},
  });
  assert.match(result.response, /scheduled hours for Fall Break/);
  assert.match(result.response, /Thursday, October 8, 2026: 6:00 AM–7:00 PM/);
  assert.match(result.response, /Friday, October 9 through Sunday, October 11, 2026: closed/);
  assert.doesNotMatch(result.response, /scheduled regular hours/);

  const closureQuestion = await tryHandleHoursQuery("Does the AC close during Fall Break?", {
    dictionary, scheduleReader: specialSchedule, now, metrics: async () => {},
  });
  assert.match(closureQuestion.response, /scheduled hours for Fall Break/);
  assert.match(closureQuestion.response, /Friday, October 9 through Sunday, October 11, 2026: closed/);
});

test("routes named closures but leaves unrelated event questions for RAG", async () => {
  const exceptionSchedule = async () => {
    const value = await schedule();
    value.exceptions = [{ date: "2026-11-26", name: "Thanksgiving Break", status: "closed", intervals: [] }];
    return value;
  };
  const closed = await tryHandleHoursQuery("AC closed for Thanksgiving?", {
    dictionary, scheduleReader: exceptionSchedule, now, metrics: async () => {},
  });
  assert.match(closed.response, /Thanksgiving Break/);
  assert.match(closed.response, /Thursday, November 26, 2026: closed/);

  const unrelated = await tryHandleHoursQuery("What events happen at AC during Fall Break?", {
    dictionary, scheduleReader: exceptionSchedule, now, metrics: async () => {},
  });
  assert.equal(unrelated, null);
});

test("preserves a shared event name across multiple dated exceptions", async () => {
  const fallBreakSchedule = async () => {
    const value = await schedule();
    value.exceptions = [
      { date: "2026-10-08", name: "Fall Break", status: "open", intervals: [{ opensAt: "06:00", closesAt: "19:00", closesNextDay: false }] },
      { date: "2026-10-09", name: "Fall Break", status: "closed", intervals: [] },
      { date: "2026-10-10", name: "Fall Break", status: "closed", intervals: [] },
      { date: "2026-10-11", name: "Fall Break", status: "closed", intervals: [] },
    ];
    return value;
  };
  const result = await tryHandleHoursQuery("Is the AC open during Fall Break?", {
    dictionary, scheduleReader: fallBreakSchedule, now, metrics: async () => {},
  });
  assert.match(result.response, /scheduled hours for Fall Break/);
  assert.doesNotMatch(result.response, /requested special dates/);
});

test("falls through to RAG instead of substituting regular hours for an unknown facility period", async () => {
  const recorded = [];
  const result = await tryHandleHoursQuery("Is the AC open during Fall Break?", {
    dictionary,
    scheduleReader: schedule,
    namedHoursDictionary: async () => [{ name: "Fall Break" }],
    now,
    metrics: async columns => recorded.push(columns),
  });
  assert.equal(result, null);
  assert.deepEqual(recorded[0], ["rag_fallbacks"]);
});

test("uses the global special-name catalog when wording omits during or for", async () => {
  const result = await tryHandleHoursQuery("What are the AC Fall Break hours?", {
    dictionary,
    scheduleReader: schedule,
    namedHoursDictionary: async () => [{ name: "Fall Break" }],
    now,
    metrics: async () => {},
  });
  assert.equal(result, null);
});

test("builds tool context only for one recognized facility", async () => {
  assert.deepEqual(
    await getHoursToolContext("Could I use the AC later?", { dictionary }),
    { facilityId: 1, facilityName: "Activity Center" },
  );
  assert.equal(await getHoursToolContext("Could I go somewhere later?", { dictionary }), null);
});

test("resolves a validated AI tool request through the deterministic hours engine", async () => {
  const recorded = [];
  const result = await resolveHoursToolLookup(
    { facilityId: 1, facilityName: "Activity Center" },
    { intent: "hours_on_date", date: "2026-09-16", specialEvent: null },
    { scheduleReader: schedule, now, metrics: async columns => recorded.push(columns) },
  );
  assert.equal(result.sourceType, "hours");
  assert.match(result.response, /Wednesday/);
  assert.deepEqual(recorded[0], ["structured_hits"]);
});

test("rejects invalid or unavailable hours tool requests", async () => {
  const context = { facilityId: 1, facilityName: "Activity Center" };
  assert.equal(await resolveHoursToolLookup(context, {
    intent: "hours_on_date", date: "not-a-date", specialEvent: null,
  }, { scheduleReader: schedule, now }), null);
  assert.equal(await resolveHoursToolLookup(context, {
    intent: "weekly_hours", date: null, specialEvent: "Unknown Break",
  }, { scheduleReader: schedule, now }), null);
});
