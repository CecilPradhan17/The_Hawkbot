import { DateTime } from "luxon";
import { CAMPUS_TIME_ZONE, DAY_NAMES } from "./hours-validation.services.js";

const formatTime = value => value === "00:00"
  ? "midnight (12:00 AM)"
  : DateTime.fromFormat(value, "HH:mm").toFormat("h:mm a");
const formatDate = value => value.toFormat("cccc, LLLL d, yyyy");
const intervalText = interval => `${formatTime(interval.opensAt)}–${formatTime(interval.closesAt)}${interval.closesNextDay ? " the next day" : ""}`;

export function ruleForDate(schedule, date) {
  const iso = date.toISODate();
  if (iso < schedule.coverageStart || iso > schedule.coverageEnd) return null;
  const exception = schedule.exceptions.find(item => item.date === iso);
  if (exception) return { ...exception, kind: "exception", label: exception.name };
  const period = schedule.specialPeriods.find(item => iso >= item.startDate && iso <= item.endDate);
  if (period) {
    const day = period.days.find(item => item.weekday === date.weekday);
    return day ? { ...day, kind: "special", label: period.name } : null;
  }
  const day = schedule.weekly.find(item => item.weekday === date.weekday);
  return day ? { ...day, kind: "regular" } : null;
}

const ruleText = rule => {
  if (!rule || rule.status === "unverified") return "unverified";
  if (rule.status === "closed") return "closed";
  return rule.intervals.map(intervalText).join(" and ");
};

const shortDate = value => value.toFormat("cccc, LLLL d");
const groupDatedRules = records => {
  const groups = [];
  for (const record of records) {
    const previous = groups.at(-1);
    if (previous && previous.text === record.text && previous.end.plus({ days: 1 }).hasSame(record.date, "day")) {
      previous.end = record.date;
    } else {
      groups.push({ start: record.date, end: record.date, text: record.text });
    }
  }
  return groups.map(group => {
    const dates = group.start.hasSame(group.end, "day")
      ? `${shortDate(group.start)}, ${group.start.year}`
      : `${shortDate(group.start)} through ${shortDate(group.end)}, ${group.end.year}`;
    return `${dates}: ${group.text}`;
  }).join("; ");
};

const namedHoursAnswer = (schedule, classification, common) => {
  const { kind, entries } = classification.namedHours;
  let records;
  let label;
  if (kind === "period") {
    const period = entries[0];
    label = period.name;
    records = [];
    let cursor = DateTime.fromISO(period.startDate, { zone: CAMPUS_TIME_ZONE }).startOf("day");
    const end = DateTime.fromISO(period.endDate, { zone: CAMPUS_TIME_ZONE }).startOf("day");
    while (cursor <= end) {
      records.push({ date: cursor, text: ruleText(ruleForDate(schedule, cursor)) });
      cursor = cursor.plus({ days: 1 });
    }
  } else {
    const names = new Map(entries.map(entry => [entry.name.trim().toLowerCase(), entry.name.trim()]));
    label = names.size === 1 ? names.values().next().value : "the requested special dates";
    records = entries
      .map(entry => ({
        date: DateTime.fromISO(entry.date, { zone: CAMPUS_TIME_ZONE }).startOf("day"),
        text: ruleText(entry),
      }))
      .sort((a, b) => a.date.toMillis() - b.date.toMillis());
  }
  return {
    ...common,
    response: `${classification.facilityName}'s scheduled hours for ${label} are ${groupDatedRules(records)}.${sourceSuffix(schedule)}`,
  };
};

const sourceSuffix = schedule => {
  const published = DateTime.fromJSDate(new Date(schedule.publishedAt), { zone: CAMPUS_TIME_ZONE }).toFormat("LLL d, yyyy");
  return `\n\nSource: ${schedule.sourceLabel}; last published ${published}.`;
};

const unverifiedAnswer = (schedule, classification, date) => ({
  response: `I don't have verified scheduled hours for ${classification.facilityName}${date ? ` on ${formatDate(date)}` : ""}.${schedule ? sourceSuffix(schedule) : ""}`,
  matched: false,
  sourceType: "hours",
  facilityId: classification.facilityId,
  intent: classification.intent,
  unverified: true,
  ...(schedule ? { sourceLabel: schedule.sourceLabel, publishedAt: schedule.publishedAt } : {}),
});

const containsMinute = (interval, minute, previousDay = false) => {
  const [openHour, openMinute] = interval.opensAt.split(":").map(Number);
  const [closeHour, closeMinute] = interval.closesAt.split(":").map(Number);
  const start = openHour * 60 + openMinute;
  const end = closeHour * 60 + closeMinute;
  if (previousDay) return interval.closesNextDay && minute < end;
  return interval.closesNextDay ? minute >= start : minute >= start && minute < end;
};

export function answerHoursQuestion(schedule, classification, now = DateTime.now().setZone(CAMPUS_TIME_ZONE)) {
  if (!schedule) return unverifiedAnswer(null, classification, classification.targetDate);
  const common = {
    matched: true,
    sourceType: "hours",
    facilityId: classification.facilityId,
    intent: classification.intent,
    sourceLabel: schedule.sourceLabel,
    publishedAt: schedule.publishedAt,
  };

  if (classification.intent === "named_hours") {
    return namedHoursAnswer(schedule, classification, common);
  }

  if (classification.intent === "weekly_hours") {
    const lines = schedule.weekly.map(day => `• ${DAY_NAMES[day.weekday - 1]}: ${ruleText(day)}`);
    return {
      ...common,
      response: `${classification.facilityName}'s scheduled regular hours:\n\n${lines.join("\n")}${sourceSuffix(schedule)}`,
    };
  }

  if (classification.intent === "open_now") {
    const today = now.startOf("day");
    const todayRule = ruleForDate(schedule, today);
    if (!todayRule || todayRule.status === "unverified") return unverifiedAnswer(schedule, classification, today);
    const minute = now.hour * 60 + now.minute;
    let active = todayRule.status === "open" && todayRule.intervals.find(interval => containsMinute(interval, minute));

    // An exact-date or special-period rule owns the whole target date. Only a
    // regular day may inherit the tail of the previous regular overnight rule.
    if (!active && todayRule.kind === "regular") {
      const previousRule = ruleForDate(schedule, today.minus({ days: 1 }));
      if (previousRule?.kind === "regular" && previousRule.status === "open") {
        active = previousRule.intervals.find(interval => containsMinute(interval, minute, true));
      }
    }
    const state = active
      ? `scheduled to be open right now, until ${formatTime(active.closesAt)}`
      : `not scheduled to be open right now. Today's scheduled hours are ${ruleText(todayRule)}`;
    return { ...common, response: `${classification.facilityName} is ${state}.${sourceSuffix(schedule)}` };
  }

  const date = classification.targetDate || now.startOf("day");
  const rule = ruleForDate(schedule, date);
  if (!rule || rule.status === "unverified") return unverifiedAnswer(schedule, classification, date);
  if (rule.status === "closed") {
    return { ...common, response: `${classification.facilityName} is scheduled to be closed on ${formatDate(date)}.${sourceSuffix(schedule)}` };
  }
  if (classification.intent === "hours_on_date") {
    return { ...common, response: `${classification.facilityName} is scheduled to be open ${ruleText(rule)} on ${formatDate(date)}.${sourceSuffix(schedule)}` };
  }

  const first = rule.intervals[0];
  const last = rule.intervals.at(-1);
  const opening = classification.intent === "opening_time";
  const time = formatTime(opening ? first.opensAt : last.closesAt);
  const eventDate = !opening && last.closesNextDay ? date.plus({ days: 1 }) : date;
  return {
    ...common,
    response: `${classification.facilityName} is scheduled to ${opening ? "open" : "close"} at ${time} on ${formatDate(eventDate)}.${sourceSuffix(schedule)}`,
  };
}
