import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { answerHoursQuestion, ruleForDate } from "../src/services/hours-resolution.services.js";
import { validSchedule } from "./helpers/hours-fixtures.js";

const publishedSchedule = () => ({
  ...validSchedule(),
  facilityName: "Activity Center",
  publishedAt: new Date("2026-08-01T12:00:00Z"),
});
const classification = (intent, targetDate = null) => ({ facilityId: 1, facilityName: "Activity Center", intent, targetDate });
const date = value => DateTime.fromISO(value, { zone: "America/Chicago" });

test("applies exception then special-period then regular precedence", () => {
  const schedule = publishedSchedule();
  schedule.specialPeriods = [{
    name: "Finals", startDate: "2026-12-01", endDate: "2026-12-07",
    days: schedule.weekly.map(day => day.weekday === 2
      ? { weekday: 2, status: "open", intervals: [{ opensAt: "10:00", closesAt: "14:00", closesNextDay: false }] }
      : day),
  }];
  schedule.exceptions = [{ date: "2026-12-01", name: "Closure", status: "closed", intervals: [] }];
  assert.equal(ruleForDate(schedule, date("2026-12-01")).kind, "exception");
  assert.equal(ruleForDate(schedule, date("2026-12-02")).kind, "special");
  assert.equal(ruleForDate(schedule, date("2026-11-30")).kind, "regular");
});

test("returns an unverified answer outside semester coverage", () => {
  const target = date("2027-01-10");
  const result = answerHoursQuestion(publishedSchedule(), classification("hours_on_date", target), target);
  assert.equal(result.unverified, true);
  assert.equal(result.matched, false);
});

test("answers from an exact-date holiday closure", () => {
  const schedule = publishedSchedule();
  schedule.exceptions = [{ date: "2026-11-26", name: "Thanksgiving", status: "closed", intervals: [] }];
  const target = date("2026-11-26");
  const result = answerHoursQuestion(schedule, classification("hours_on_date", target), target);
  assert.match(result.response, /scheduled to be closed/);
  assert.match(result.response, /Source: Fall 2026 schedule/);
});

test("recognizes the previous regular day's overnight interval", () => {
  const schedule = publishedSchedule();
  schedule.weekly[4] = { weekday: 5, status: "open", intervals: [{ opensAt: "20:00", closesAt: "02:00", closesNextDay: true }] };
  schedule.weekly[5] = { weekday: 6, status: "closed", intervals: [] };
  const now = date("2026-09-19T01:00:00");
  const result = answerHoursQuestion(schedule, classification("open_now"), now);
  assert.match(result.response, /open right now/);
  assert.match(result.response, /until 2:00 AM/);
});

test("describes a next-day midnight closing with its actual date", () => {
  const schedule = publishedSchedule();
  schedule.weekly[0] = { weekday: 1, status: "open", intervals: [{ opensAt: "07:30", closesAt: "00:00", closesNextDay: true }] };
  const monday = date("2026-09-21");
  const result = answerHoursQuestion(schedule, classification("closing_time", monday), monday);
  assert.match(result.response, /close at midnight \(12:00 AM\) on Tuesday, September 22, 2026/);
  assert.doesNotMatch(result.response, /the next day on Monday/);
});

test("keeps ordinary closing-time wording unchanged", () => {
  const monday = date("2026-09-21");
  const result = answerHoursQuestion(publishedSchedule(), classification("closing_time", monday), monday);
  assert.match(result.response, /close at 5:00 PM on Monday, September 21, 2026/);
});

test("an exact-date closure blocks the previous overnight interval", () => {
  const schedule = publishedSchedule();
  schedule.weekly[4] = { weekday: 5, status: "open", intervals: [{ opensAt: "20:00", closesAt: "02:00", closesNextDay: true }] };
  schedule.exceptions = [{ date: "2026-09-19", name: "Closure", status: "closed", intervals: [] }];
  const result = answerHoursQuestion(schedule, classification("open_now"), date("2026-09-19T01:00:00"));
  assert.match(result.response, /not scheduled to be open/);
});

test("uses the campus timezone across a daylight-saving transition", () => {
  const local = DateTime.fromISO("2026-11-01T01:30:00", { zone: "America/Chicago" });
  assert.equal(local.zoneName, "America/Chicago");
  assert.doesNotThrow(() => answerHoursQuestion(publishedSchedule(), classification("open_now"), local));
});
