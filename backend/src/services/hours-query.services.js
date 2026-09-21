import { DateTime } from "luxon";
import { CAMPUS_TIME_ZONE, DAY_NAMES } from "./hours-validation.services.js";
import { normalizeAlias } from "./hours-publication.services.js";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const nextOccurrence = (now, weekday) => now.plus({ days: (weekday - now.weekday + 7) % 7 }).startOf("day");
const rollForwardMissingYear = (date, now, yearWasSpecified) =>
  !yearWasSpecified && date.isValid && date < now.startOf("day") ? date.plus({ years: 1 }) : date;

export function parseTargetDate(message, now = DateTime.now().setZone(CAMPUS_TIME_ZONE)) {
  const normalized = normalizeAlias(message);
  if (/\btoday\b/.test(normalized)) return now.startOf("day");
  if (/\bday after tomorrow\b/.test(normalized)) return now.plus({ days: 2 }).startOf("day");
  if (/\b(?:tomorrow|tmrw)\b/.test(normalized)) return now.plus({ days: 1 }).startOf("day");

  const isoMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    const parsed = DateTime.fromISO(isoMatch[1], { zone: CAMPUS_TIME_ZONE });
    return parsed.isValid ? parsed.startOf("day") : null;
  }

  const numericMatch = message.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericMatch) {
    let year = numericMatch[3] ? Number(numericMatch[3]) : now.year;
    if (year < 100) year += 2000;
    let parsed = DateTime.fromObject({ year, month: Number(numericMatch[1]), day: Number(numericMatch[2]) }, { zone: CAMPUS_TIME_ZONE });
    parsed = rollForwardMissingYear(parsed, now, Boolean(numericMatch[3]));
    return parsed.isValid ? parsed.startOf("day") : null;
  }

  const monthMatch = normalized.match(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b`, "i"));
  if (monthMatch) {
    const specifiedYear = monthMatch[3] ? Number(monthMatch[3]) : now.year;
    let parsed = DateTime.fromObject({
      year: specifiedYear,
      month: MONTHS.indexOf(monthMatch[1].toLowerCase()) + 1,
      day: Number(monthMatch[2]),
    }, { zone: CAMPUS_TIME_ZONE });
    parsed = rollForwardMissingYear(parsed, now, Boolean(monthMatch[3]));
    return parsed.isValid ? parsed.startOf("day") : null;
  }

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    if (new RegExp(`\\b${DAY_NAMES[weekday - 1]}s?\\b`, "i").test(message)) {
      return nextOccurrence(now, weekday);
    }
  }
  return null;
}

export function classifyHoursQuestion(message, dictionary, now = DateTime.now().setZone(CAMPUS_TIME_ZONE)) {
  const normalized = normalizeAlias(message);
  if (!normalized || /\bhow close\b|\bclose to\b|\bnear(?:est)?\b/.test(normalized)) return null;

  const padded = ` ${normalized} `;
  const facilities = new Map();
  for (const entry of dictionary) {
    if (padded.includes(` ${entry.normalized_alias} `)) facilities.set(entry.id, entry);
  }
  if (facilities.size > 1) return { ambiguous: true };
  if (facilities.size === 0) return null;

  const facility = [...facilities.values()][0];
  const targetDate = parseTargetDate(message, now);
  let intent;
  if (/\bopen (?:right )?now\b|\bcurrently open\b/.test(normalized)) intent = "open_now";
  else if (/\bwhen (?:does|will|is)\b.*\b(?:open|opening)\b|\bwhat time\b.*\b(?:open|opening)\b|\bopening time\b/.test(normalized)) intent = "opening_time";
  else if (/\bwhen (?:does|will|is)\b.*\b(?:close|closing)\b|\bwhat time\b.*\b(?:close|closing)\b|\bclosing time\b/.test(normalized)) intent = "closing_time";
  else if (/\bhours?\b|\bschedule\b|\bis\b.*\bopen\b/.test(normalized)) intent = targetDate ? "hours_on_date" : "weekly_hours";
  else return null;

  const date = targetDate || (["opening_time", "closing_time"].includes(intent) ? now.startOf("day") : null);
  return { facilityId: facility.id, facilityName: facility.name, intent, targetDate: date };
}
