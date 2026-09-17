import { emptyWeek } from "../../src/services/hours-validation.services.js";

export const openDay = (weekday, opensAt = "08:00", closesAt = "17:00", closesNextDay = false) => ({
  weekday,
  status: "open",
  intervals: [{ opensAt, closesAt, closesNextDay }],
});

export const validSchedule = () => ({
  facilityId: 1,
  sourceLabel: "Fall 2026 schedule",
  coverageStart: "2026-08-17",
  coverageEnd: "2026-12-18",
  weekly: emptyWeek().map(day => day.weekday <= 5 ? openDay(day.weekday) : { ...day, status: "closed" }),
  specialPeriods: [],
  exceptions: [],
  warnings: [],
});

