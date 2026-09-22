import { DateTime } from "luxon";
import { CAMPUS_TIME_ZONE } from "./hours-validation.services.js";
import { classifyHoursQuestion, matchNamedHoursEntries } from "./hours-query.services.js";
import { answerHoursQuestion } from "./hours-resolution.services.js";
import { getFacilityDictionary, getNamedHoursDictionary, getPublishedSchedule, incrementHoursMetrics } from "./hours-repository.services.js";
import { normalizeAlias } from "./hours-publication.services.js";

const record = (columns, metrics) => metrics(columns).catch(error => {
  console.error("Hours metrics failed:", error.message);
});

export async function getHoursToolContext(message, dependencies = {}) {
  const dictionary = dependencies.dictionary || getFacilityDictionary;
  const normalized = normalizeAlias(message);
  if (!normalized) return null;
  const padded = ` ${normalized} `;
  const facilities = new Map();
  for (const entry of await dictionary()) {
    if (padded.includes(` ${entry.normalized_alias} `)) facilities.set(entry.id, entry);
  }
  if (facilities.size !== 1) return null;
  const facility = [...facilities.values()][0];
  return { facilityId: facility.id, facilityName: facility.name };
}

export async function resolveHoursToolLookup(context, lookup, dependencies = {}) {
  if (!context || !lookup || typeof lookup !== "object") return null;
  const scheduleReader = dependencies.scheduleReader || getPublishedSchedule;
  const metrics = dependencies.metrics || incrementHoursMetrics;
  const now = dependencies.now || DateTime.now().setZone(CAMPUS_TIME_ZONE);
  const supportedIntents = new Set(["open_now", "opening_time", "closing_time", "hours_on_date", "weekly_hours"]);
  const schedule = await scheduleReader(context.facilityId);
  if (!schedule) return null;

  let classification;
  if (typeof lookup.specialEvent === "string" && lookup.specialEvent.trim()) {
    const namedHours = matchNamedHoursEntries(lookup.specialEvent, schedule);
    if (!namedHours) return null;
    classification = { ...context, intent: "named_hours", targetDate: null, namedHours };
  } else {
    if (!supportedIntents.has(lookup.intent)) return null;
    let targetDate = null;
    if (typeof lookup.date === "string" && lookup.date) {
      const parsed = DateTime.fromISO(lookup.date, { zone: CAMPUS_TIME_ZONE });
      if (!parsed.isValid) return null;
      targetDate = parsed.startOf("day");
    }
    if (lookup.intent === "hours_on_date" && !targetDate) return null;
    if (["opening_time", "closing_time"].includes(lookup.intent) && !targetDate) targetDate = now.startOf("day");
    classification = { ...context, intent: lookup.intent, targetDate };
  }

  const answer = answerHoursQuestion(schedule, classification, now);
  if (answer.unverified) return null;
  record(["structured_hits"], metrics);
  return answer;
}

export async function tryHandleHoursQuery(message, dependencies = {}) {
  const dictionary = dependencies.dictionary || getFacilityDictionary;
  const scheduleReader = dependencies.scheduleReader || getPublishedSchedule;
  const namedHoursDictionary = dependencies.namedHoursDictionary || getNamedHoursDictionary;
  const metrics = dependencies.metrics || incrementHoursMetrics;
  const now = dependencies.now || DateTime.now().setZone(CAMPUS_TIME_ZONE);

  let facilities;
  try {
    facilities = await dictionary();
  } catch (error) {
    // Allows a safe RAG fallback during a deployment where code starts before
    // migration 014 has been applied. Other database errors remain visible.
    if (error.code === "42P01") return null;
    throw error;
  }

  const classification = classifyHoursQuestion(message, facilities, now);
  if (!classification) {
    record(["rag_fallbacks"], metrics);
    return null;
  }
  if (classification.ambiguous) {
    record(["ambiguous_fallbacks", "rag_fallbacks"], metrics);
    return null;
  }

  const schedule = await scheduleReader(classification.facilityId);
  const namedHours = matchNamedHoursEntries(message, schedule);
  if (!namedHours && classification.intent === "weekly_hours") {
    const explicitlyContextual = /\b(?:during|over|for)\b/i.test(message);
    const knownNames = explicitlyContextual ? [] : await namedHoursDictionary();
    const namesAnotherScheduleRecognizes = matchNamedHoursEntries(message, {
      specialPeriods: knownNames,
      exceptions: [],
    });
    if (explicitlyContextual || namesAnotherScheduleRecognizes) {
      record(["rag_fallbacks"], metrics);
      return null;
    }
  }
  const resolvedClassification = namedHours
    ? { ...classification, intent: "named_hours", namedHours }
    : classification;
  const answer = answerHoursQuestion(schedule, resolvedClassification, now);
  record([
    answer.unverified ? "unverified_answers" : "structured_hits",
    "embedding_calls_avoided",
    "llm_calls_avoided",
  ], metrics);
  return answer;
}
