import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { classifyHoursQuestion, matchNamedHoursEntries, parseTargetDate } from "../src/services/hours-query.services.js";

const dictionary = [
  { id: 1, name: "Activity Center", normalized_alias: "activity center" },
  { id: 1, name: "Activity Center", normalized_alias: "ac" },
  { id: 2, name: "Library", normalized_alias: "library" },
  { id: 3, name: "HUB", normalized_alias: "hub" },
  { id: 4, name: "Dining", normalized_alias: "dining" },
];
const now = DateTime.fromISO("2026-09-16T10:00:00", { zone: "America/Chicago" });

test("classifies facility aliases and hours intents", () => {
  assert.equal(classifyHoursQuestion("Is the AC open right now?", dictionary, now).intent, "open_now");
  assert.equal(classifyHoursQuestion("Is HUB open rn?", dictionary, now).intent, "open_now");
  assert.equal(classifyHoursQuestion("When does the library close today?", dictionary, now).intent, "closing_time");
  assert.equal(classifyHoursQuestion("What are the HUB hours on Friday?", dictionary, now).intent, "hours_on_date");
  assert.equal(classifyHoursQuestion("When is the dining opening today?", dictionary, now).intent, "opening_time");
  assert.equal(classifyHoursQuestion("When is dining closing today?", dictionary, now).intent, "closing_time");
  assert.equal(classifyHoursQuestion("When AC open?", dictionary, now).intent, "opening_time");
  assert.equal(classifyHoursQuestion("When AC close?", dictionary, now).intent, "closing_time");
  assert.equal(classifyHoursQuestion("What time AC close?", dictionary, now).intent, "closing_time");
  assert.equal(classifyHoursQuestion("Is HUB open?", dictionary, now).intent, "weekly_hours");
});

test("requires a recognized facility for shortened hours questions", () => {
  assert.equal(classifyHoursQuestion("When?", dictionary, now), null);
  assert.equal(classifyHoursQuestion("When does it close?", dictionary, now), null);
  assert.equal(classifyHoursQuestion("What time does it open?", dictionary, now), null);
});

test("does not confuse distance questions with closing-time intent", () => {
  assert.equal(classifyHoursQuestion("How close is the library to the HUB?", dictionary, now), null);
});

test("returns ambiguity instead of guessing when aliases identify two facilities", () => {
  const ambiguousDictionary = [...dictionary, { id: 4, name: "Academic Center", normalized_alias: "ac" }];
  assert.deepEqual(classifyHoursQuestion("What are the AC hours?", ambiguousDictionary, now), { ambiguous: true });
});

test("uses stored special-period and exception names as dynamic keywords", () => {
  const schedule = {
    specialPeriods: [{ name: "Fall Break" }, { name: "Finals Week/Commencement" }],
    exceptions: [
      { name: "Thanksgiving Break" },
      { name: "ULM Football Games - Southeastern" },
      { name: "ULM Football Games - Louisiana Tech" },
    ],
  };
  assert.equal(matchNamedHoursEntries("Is the AC open during fall break?", schedule).entries[0].name, "Fall Break");
  assert.equal(matchNamedHoursEntries("AC hours for finals", schedule).entries[0].name, "Finals Week/Commencement");
  assert.equal(matchNamedHoursEntries("AC closed for Thanksgiving?", schedule).entries[0].name, "Thanksgiving Break");
  assert.equal(matchNamedHoursEntries("AC hours for ULM football games", schedule).entries.length, 2);
  assert.equal(matchNamedHoursEntries("What is happening at the AC?", schedule), null);
});

test("interprets bare weekdays as the next occurrence including today", () => {
  assert.equal(parseTargetDate("hours Wednesday", now).toISODate(), "2026-09-16");
  assert.equal(parseTargetDate("hours Friday", now).toISODate(), "2026-09-18");
});

test("uses the next occurrence for month/day without a year", () => {
  assert.equal(parseTargetDate("hours 9/15", now).toISODate(), "2027-09-15");
  assert.equal(parseTargetDate("hours 10/2", now).toISODate(), "2026-10-02");
});
