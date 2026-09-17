import { DateTime } from "luxon";
import { CAMPUS_TIME_ZONE, DAY_NAMES } from "./hours-validation.services.js";

const formatTime = value => DateTime.fromFormat(value, "HH:mm").toFormat("h:mm a");
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

const sourceSuffix = schedule => {
  const published = DateTime.fromJSDate(new Date(schedule.publishedAt), { zone: CAMPUS_TIME_ZONE }).toFormat("LLL d, yyyy");
  return ` Source: ${schedule.sourceLabel}; last published ${published}.`;
};

const unverifiedAnswer = (schedule, classification, date) => ({
  response: `I don't have verified scheduled hours for ${classification.facilityName}${date ? ` on ${formatDate(date)}` : ""}.`,
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

  if (classification.intent === "weekly_hours") {
    const lines = schedule.weekly.map(day => `${DAY_NAMES[day.weekday - 1]}: ${ruleText(day)}`);
    return { ...common, response: `${classification.facilityName}'s scheduled regular hours are ${lines.join("; ")}.${sourceSuffix(schedule)}` };
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
  const nextDay = !opening && last.closesNextDay ? " the next day" : "";
  return {
    ...common,
    response: `${classification.facilityName} is scheduled to ${opening ? "open" : "close"} at ${time}${nextDay} on ${formatDate(date)}.${sourceSuffix(schedule)}`,
  };
}

