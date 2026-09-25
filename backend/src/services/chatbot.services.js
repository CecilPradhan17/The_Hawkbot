import pool from "../db.js";
import { DateTime } from "luxon";
import { generateQueryEmbedding } from "./embedding.services.js";
import { polishResponse } from "./llm.services.js";
import { resolveHoursToolLookup, tryHandleHoursQuery } from "./hours-chat.services.js";
import { tryHandleSmalltalk } from "./smalltalk.services.js";
import { formatKnowledgeCandidates, isConfidentCandidate, retrieveKnowledgeCandidates } from "./rag-retrieval.services.js";
import { expandCampusPlaceAliases } from "./campus-place-alias.services.js";
import { getFacilityDictionary } from "./hours-repository.services.js";

/**
 * Orchestrates deterministic structured answers before the existing RAG flow.
 * A confident hours match returns immediately without an embedding or LLM call.
 * Uncertain and non-hours questions preserve the original RAG behavior.
 */
const FALLBACK_MESSAGE =
  "I don't have the answer to that yet. Try posting this question on the HawkWall and another student can answer you!";

export const buildFacilityCatalog = rows => {
  const facilities = new Map();
  for (const row of rows || []) {
    const id = Number(row.id ?? row.facilityId);
    if (!Number.isInteger(id) || !row.name && !row.facilityName) continue;
    const current = facilities.get(id) || {
      facilityId: id,
      facilityName: row.name || row.facilityName,
      aliases: [],
    };
    const alias = row.normalized_alias;
    if (alias && !current.aliases.includes(alias)) current.aliases.push(alias);
    facilities.set(id, current);
  }
  return [...facilities.values()];
};

export const handleChatQuery = async (userMessage, dependencies = {}) => {
  const smalltalkHandler = dependencies.smalltalkHandler || tryHandleSmalltalk;
  const embedding = dependencies.embedding || generateQueryEmbedding;
  const database = dependencies.database || pool;
  let facilityDictionaryPromise;
  const facilityDictionary = dependencies.facilityDictionary || (() => {
    facilityDictionaryPromise ||= getFacilityDictionary(database);
    return facilityDictionaryPromise;
  });
  const hoursHandler = dependencies.hoursHandler
    || (query => tryHandleHoursQuery(query, { dictionary: facilityDictionary }));
  const retriever = dependencies.retriever
    || ((queryEmbedding, queryText) => retrieveKnowledgeCandidates(queryEmbedding, queryText, { database }));
  const polisher = dependencies.polisher || polishResponse;
  const hoursToolResolver = dependencies.hoursToolResolver || resolveHoursToolLookup;
  const aliasExpander = dependencies.aliasExpander
    || (dependencies.retriever
      ? async query => query
      : query => expandCampusPlaceAliases(query, { dictionary: facilityDictionary }));

  const smalltalkResult = await smalltalkHandler(userMessage);
  if (smalltalkResult) return smalltalkResult;

  // Structured campus hours are authoritative for recognized hours questions.
  // An uncovered date returns an explicit unverified response rather than stale RAG data.
  const hoursResult = await hoursHandler(userMessage);
  if (hoursResult) return hoursResult;

  let retrievalQuery = userMessage;
  try {
    retrievalQuery = await aliasExpander(userMessage);
  } catch (error) {
    // Alias expansion improves recall but must never prevent ordinary RAG.
    console.error("Campus place alias expansion failed:", error.message);
  }
  const queryEmbedding = await embedding(retrievalQuery);
  const candidates = await retriever(queryEmbedding, retrievalQuery);

  const vectorScores = candidates.map(row => Number(row.similarity)).filter(Number.isFinite);
  const similarity = vectorScores.length ? Math.max(...vectorScores).toFixed(4) : null;
  const confidentRows = candidates.filter(isConfidentCandidate);
  let facilities = [];
  try {
    if (dependencies.facilityCatalog) {
      facilities = await dependencies.facilityCatalog();
    } else if (dependencies.hoursToolContext) {
      const legacyContext = await dependencies.hoursToolContext(userMessage);
      facilities = legacyContext ? [legacyContext] : [];
    } else {
      facilities = buildFacilityCatalog(await facilityDictionary());
    }
  } catch (error) {
    console.error("Hours tool catalog failed:", error.message);
  }
  if (confidentRows.length === 0 && facilities.length === 0) {
    return { response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" };
  }

  const candidateIds = confidentRows.map(row => Number(row.id));
  const combinedKnowledge = formatKnowledgeCandidates(confidentRows);
  let polished = await polisher(userMessage, combinedKnowledge, {
    facilities,
    // Temporary compatibility for injected polishers while the public option is the catalog.
    facility: facilities.length === 1 ? facilities[0] : null,
    allowHoursTool: facilities.length > 0,
    currentDate: DateTime.now().setZone("America/Chicago").toISODate(),
    candidateIds,
  });
  if (polished?.hoursLookup) {
    const requestedId = Number(polished.hoursLookup.facilityId);
    const facility = facilities.find(item => item.facilityId === requestedId)
      || (facilities.length === 1 && !Number.isInteger(requestedId) ? facilities[0] : null);
    const lookup = { ...polished.hoursLookup };
    delete lookup.facilityId;
    const hoursAnswer = facility ? await hoursToolResolver(facility, lookup) : null;
    if (hoursAnswer) return hoursAnswer;
    if (confidentRows.length === 0) {
      return { response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" };
    }
    polished = await polisher(userMessage, combinedKnowledge, { allowHoursTool: false, candidateIds });
  }
  const selectedIds = Array.isArray(polished?.relevantCandidateIds)
    ? [...new Set(polished.relevantCandidateIds.map(Number))]
    : [];
  const allowedIds = new Set(candidateIds);
  const validSelection = selectedIds.length > 0
    && selectedIds.every(id => Number.isInteger(id) && allowedIds.has(id));
  if (!polished?.answerable || !polished.response?.trim() || !validSelection) {
    return { response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" };
  }
  return {
    response: polished.response.trim(), matched: true, similarity, sourceType: "rag",
    knowledgeIds: selectedIds,
  };
};
