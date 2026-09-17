import { DateTime } from "luxon";

export const CAMPUS_TIME_ZONE = "America/Chicago";
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STATUSES = new Set(["open", "closed", "unverified"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validDate = (value) =>
  typeof value === "string" && DateTime.fromISO(value, { zone: CAMPUS_TIME_ZONE }).isValid;

const minutes = (value) => {
  const [, hour, minute] = TIME_RE.exec(value) || [];
  return hour === undefined ? null : Number(hour) * 60 + Number(minute);
};

function validateIntervals(intervals, path, errors) {
  if (!Array.isArray(intervals)) {
    errors.push(`${path}.intervals must be an array`);
    return;
  }

  const ranges = [];
  intervals.forEach((interval, index) => {
    const itemPath = `${path}.intervals[${index}]`;
    const start = minutes(interval?.opensAt);
    const rawEnd = minutes(interval?.closesAt);
    if (start === null || rawEnd === null) {
      errors.push(`${itemPath} must use 24-hour HH:mm times`);
      return;
    }

    const nextDay = interval.closesNextDay === true;
    const end = rawEnd + (nextDay ? 1440 : 0);
    if (end <= start) {
      errors.push(`${itemPath} closes before it opens; mark it as closing next day if intentional`);
      return;
    }
    if (end - start > 1440) errors.push(`${itemPath} cannot exceed 24 hours`);
    ranges.push({ start, end, itemPath });
  });

  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i += 1) {
    if (ranges[i].start < ranges[i - 1].end) {
      errors.push(`${ranges[i].itemPath} overlaps another interval`);
    }
  }
}

function validateDay(day, path, errors) {
  if (!WEEKDAYS.includes(day?.weekday)) errors.push(`${path}.weekday must be 1 through 7`);
  if (!STATUSES.has(day?.status)) errors.push(`${path}.status is invalid`);
  validateIntervals(day?.intervals, path, errors);
  if (day?.status === "open" && day?.intervals?.length === 0) {
    errors.push(`${path} is open but has no intervals`);
  }
  if (day?.status !== "open" && day?.intervals?.length > 0) {
    errors.push(`${path} cannot have intervals unless its status is open`);
  }
}

function validateCompleteWeek(days, path, errors) {
  if (!Array.isArray(days)) {
    errors.push(`${path} must be an array`);
    return;
  }
  const seen = new Set();
  days.forEach((day, index) => {
    validateDay(day, `${path}[${index}]`, errors);
    if (seen.has(day?.weekday)) errors.push(`${path} contains a duplicate weekday`);
    seen.add(day?.weekday);
  });
  for (const weekday of WEEKDAYS) {
    if (!seen.has(weekday)) errors.push(`${path} is missing ${DAY_NAMES[weekday - 1]}`);
  }
}

export function validateSchedule(schedule) {
  const errors = [];
  const warnings = [];

  if (!Number.isInteger(schedule?.facilityId) || schedule.facilityId <= 0) {
    errors.push("facilityId is required");
  }
  if (!schedule?.sourceLabel?.trim()) errors.push("sourceLabel is required");
  if (!validDate(schedule?.coverageStart)) errors.push("coverageStart must be YYYY-MM-DD");
  if (!validDate(schedule?.coverageEnd)) errors.push("coverageEnd must be YYYY-MM-DD");
  if (validDate(schedule?.coverageStart) && validDate(schedule?.coverageEnd)
      && schedule.coverageStart > schedule.coverageEnd) {
    errors.push("coverageStart must not be after coverageEnd");
  }

  validateCompleteWeek(schedule?.weekly, "weekly", errors);

  const periods = Array.isArray(schedule?.specialPeriods) ? schedule.specialPeriods : [];
  periods.forEach((period, index) => {
    const path = `specialPeriods[${index}]`;
    if (!period?.name?.trim()) errors.push(`${path}.name is required`);
    if (!validDate(period?.startDate) || !validDate(period?.endDate)) {
      errors.push(`${path} dates must use YYYY-MM-DD`);
    } else {
      if (period.startDate > period.endDate) errors.push(`${path} starts after it ends`);
      if (period.startDate < schedule.coverageStart || period.endDate > schedule.coverageEnd) {
        errors.push(`${path} must be inside schedule coverage`);
      }
    }
    validateCompleteWeek(period?.days, `${path}.days`, errors);
  });

  const sortedPeriods = periods
    .filter(period => validDate(period.startDate) && validDate(period.endDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let i = 1; i < sortedPeriods.length; i += 1) {
    if (sortedPeriods[i].startDate <= sortedPeriods[i - 1].endDate) {
      errors.push(`Special periods "${sortedPeriods[i - 1].name}" and "${sortedPeriods[i].name}" overlap`);
    }
  }

  const exceptions = Array.isArray(schedule?.exceptions) ? schedule.exceptions : [];
  const exceptionDates = new Set();
  exceptions.forEach((exception, index) => {
    const path = `exceptions[${index}]`;
    if (!validDate(exception?.date)) errors.push(`${path}.date must use YYYY-MM-DD`);
    else {
      if (exceptionDates.has(exception.date)) errors.push(`Multiple exceptions use ${exception.date}`);
      exceptionDates.add(exception.date);
      if (exception.date < schedule.coverageStart || exception.date > schedule.coverageEnd) {
        errors.push(`${path} must be inside schedule coverage`);
      }
    }
    if (!exception?.name?.trim()) errors.push(`${path}.name is required`);
    validateDay({ ...exception, weekday: 1 }, path, errors);
  });

  for (const warning of schedule?.warnings || []) {
    if (typeof warning === "string" && warning.trim()) warnings.push(warning.trim());
  }
  return { valid: errors.length === 0, errors, warnings };
}

export const emptyWeek = () => WEEKDAYS.map(weekday => ({
  weekday,
  status: "unverified",
  intervals: [],
}));
