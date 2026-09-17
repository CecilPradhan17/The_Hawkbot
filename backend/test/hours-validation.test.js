import test from "node:test";
import assert from "node:assert/strict";
import { emptyWeek, validateSchedule } from "../src/services/hours-validation.services.js";

const openDay = (weekday, opensAt = "08:00", closesAt = "17:00", closesNextDay = false) => ({
  weekday,
  status: "open",
  intervals: [{ opensAt, closesAt, closesNextDay }],
});

const validSchedule = () => ({
  facilityId: 1,
  sourceLabel: "Fall 2026 schedule",
  coverageStart: "2026-08-17",
  coverageEnd: "2026-12-18",
  weekly: emptyWeek().map(day => day.weekday <= 5 ? openDay(day.weekday) : { ...day, status: "closed" }),
  specialPeriods: [],
  exceptions: [],
  warnings: [],
});

test("accepts a complete regular schedule", () => {
  const result = validateSchedule(validSchedule());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("requires an explicit state for all seven weekdays", () => {
  const schedule = validSchedule();
  schedule.weekly.pop();
  const result = validateSchedule(schedule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("missing Sunday")));
});

test("rejects overlapping intervals", () => {
  const schedule = validSchedule();
  schedule.weekly[0].intervals = [
    { opensAt: "08:00", closesAt: "12:00", closesNextDay: false },
    { opensAt: "11:00", closesAt: "15:00", closesNextDay: false },
  ];
  const result = validateSchedule(schedule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("overlaps another interval")));
});

test("allows a declared overnight interval", () => {
  const schedule = validSchedule();
  schedule.weekly[4] = openDay(5, "20:00", "02:00", true);
  assert.equal(validateSchedule(schedule).valid, true);
});

test("rejects a closing time before opening without overnight intent", () => {
  const schedule = validSchedule();
  schedule.weekly[4] = openDay(5, "20:00", "02:00", false);
  const result = validateSchedule(schedule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("closes before it opens")));
});

test("rejects intervals on a closed day", () => {
  const schedule = validSchedule();
  schedule.weekly[6] = { ...openDay(7), status: "closed" };
  const result = validateSchedule(schedule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("cannot have intervals")));
});

test("rejects overlapping special periods", () => {
  const schedule = validSchedule();
  schedule.specialPeriods = [
    { name: "Finals", startDate: "2026-12-01", endDate: "2026-12-10", days: schedule.weekly },
    { name: "Winter hours", startDate: "2026-12-10", endDate: "2026-12-18", days: schedule.weekly },
  ];
  const result = validateSchedule(schedule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("overlap")));
});

test("rejects duplicate and out-of-coverage exceptions", () => {
  const schedule = validSchedule();
  schedule.exceptions = [
    { date: "2026-12-25", name: "Holiday", status: "closed", intervals: [] },
    { date: "2026-12-25", name: "Duplicate", status: "closed", intervals: [] },
  ];
  const result = validateSchedule(schedule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("Multiple exceptions")));
  assert.ok(result.errors.some(error => error.includes("inside schedule coverage")));
});

test("preserves extraction warnings without treating them as valid data", () => {
  const schedule = validSchedule();
  schedule.warnings = ["The year was unreadable"];
  const result = validateSchedule(schedule);
  assert.deepEqual(result.warnings, ["The year was unreadable"]);
});
