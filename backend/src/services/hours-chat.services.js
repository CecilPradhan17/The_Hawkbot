import { DateTime } from "luxon";
import { CAMPUS_TIME_ZONE } from "./hours-validation.services.js";
import { classifyHoursQuestion } from "./hours-query.services.js";
import { answerHoursQuestion } from "./hours-resolution.services.js";
import { getFacilityDictionary, getPublishedSchedule, incrementHoursMetrics } from "./hours-repository.services.js";

const record = (columns, metrics) => metrics(columns).catch(error => {
  console.error("Hours metrics failed:", error.message);
});

export async function tryHandleHoursQuery(message, dependencies = {}) {
  const dictionary = dependencies.dictionary || getFacilityDictionary;
  const scheduleReader = dependencies.scheduleReader || getPublishedSchedule;
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
  const answer = answerHoursQuestion(schedule, classification, now);
  record([
    answer.unverified ? "unverified_answers" : "structured_hits",
    "embedding_calls_avoided",
    "llm_calls_avoided",
  ], metrics);
  return answer;
}

