import pool from "../db.js";
import { DateTime } from "luxon";
import { generateQueryEmbedding } from "./embedding.services.js";
import { polishResponse } from "./llm.services.js";
import { resolveHoursToolLookup, tryHandleHoursQuery } from "./hours-chat.services.js";
import { tryHandleSmalltalk } from "./smalltalk.services.js";
import {
  buildKnowledgeSources,
  formatKnowledgeCandidates,
  isConfidentCandidate,
  retrieveKnowledgeCandidates,
} from "./rag-retrieval.services.js";
import {
  expandCampusPlaceAliases,
  resolveCampusPlaceRelationships,
} from "./campus-place-alias.services.js";
import { getFacilityDictionary } from "./hours-repository.services.js";
import { diningMenuLinkResponse, tryHandleDiningMenuLink } from "./dining-menu-link.services.js";
import { getOfficialResourceCatalog } from "./official-resource.services.js";
import { retrieveUnifiedEvidence } from "./unified-retrieval.services.js";
import {
  buildClarificationState,
  buildContextualQuery,
  canClarify,
  sanitizeChatContext,
} from "./chat-context.services.js";
import { orchestrateChatQuery } from "./chatbot-orchestrator.services.js";

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

const isMixedRequest = message => {
  const text = String(message || "").toLowerCase();
  return /\b(?:and|also|plus|but|while)\b/.test(text)
    || /[;]\s*\w/.test(text);
};

// Keep the existing response shape for terminal deterministic/fallback routes.
// Conversational action metadata is emitted only when the LLM participates.
const withAction = result => result;

const buildOfficialSources = resources => resources.map(resource => ({
  type: "official",
  title: resource.name,
  url: resource.url,
  lastVerifiedAt: resource.lastVerifiedAt || null,
}));

const mergeSources = (...groups) => {
  const seen = new Set();
  return groups.flat().filter(source => {
    const key = source.url || `${source.type}:${source.postId || source.title}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const handleChatQuery = async (userMessage, dependencies = {}, rawContext = {}) => {
  const context = sanitizeChatContext(rawContext);
  // Production uses the tool-orchestrated cascade. The dependency-injected
  // branch below remains temporarily for the established focused unit tests
  // and can be removed once those fixtures target the registry interface.
  if (Object.keys(dependencies).length === 0) {
    return orchestrateChatQuery(userMessage, { context });
  }
  const smalltalkHandler = dependencies.smalltalkHandler || tryHandleSmalltalk;
  const diningMenuHandler = dependencies.diningMenuHandler || tryHandleDiningMenuLink;
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
  const resourceCatalog = dependencies.resourceCatalog
    || (dependencies.retriever ? async () => [] : () => getOfficialResourceCatalog(database));
  const hoursToolResolver = dependencies.hoursToolResolver || resolveHoursToolLookup;
  const aliasExpander = dependencies.aliasExpander
    || (dependencies.retriever
      ? async query => query
      : query => expandCampusPlaceAliases(query, { dictionary: facilityDictionary }));
  const relationshipResolver = dependencies.relationshipResolver
    || (dependencies.retriever || dependencies.aliasExpander
      ? async () => []
      : query => resolveCampusPlaceRelationships(query, { dictionary: facilityDictionary }));

  const smalltalkResult = await smalltalkHandler(userMessage);
  if (smalltalkResult && !isMixedRequest(userMessage)) return withAction(smalltalkResult);

  const diningMenuResult = await diningMenuHandler(userMessage, { dictionary: facilityDictionary });
  if (diningMenuResult && !isMixedRequest(userMessage)) return withAction(diningMenuResult);

  // Structured campus hours are authoritative for recognized hours questions.
  // An uncovered date returns an explicit unverified response rather than stale RAG data.
  const hoursResult = await hoursHandler(userMessage);
  if (hoursResult && !isMixedRequest(userMessage)) return withAction(hoursResult);

  let retrievalQuery = buildContextualQuery(userMessage, context);
  let trustedRelationships = [];
  try {
    trustedRelationships = await relationshipResolver(retrievalQuery);
  } catch (error) {
    console.error("Campus relationship resolution failed:", error.message);
  }
  try {
    retrievalQuery = await aliasExpander(retrievalQuery);
  } catch (error) {
    // Alias expansion improves recall but must never prevent ordinary RAG.
    console.error("Campus place alias expansion failed:", error.message);
  }
  const queryEmbedding = await embedding(retrievalQuery);
  let candidates = [];
  let officialResources = [];
  let facilities = [];
  if (dependencies.unifiedRetriever) {
    ({ knowledge: candidates = [], officialResources = [], facilities = [] }
      = await dependencies.unifiedRetriever(queryEmbedding, retrievalQuery));
  } else if (dependencies.retriever || dependencies.resourceCatalog || dependencies.facilityCatalog || dependencies.hoursToolContext) {
    candidates = await retriever(queryEmbedding, retrievalQuery);
    try {
      officialResources = await resourceCatalog();
    } catch (error) {
      console.error("Official resource retrieval failed:", error.message);
    }
    try {
      if (dependencies.facilityCatalog) facilities = await dependencies.facilityCatalog();
      else if (dependencies.hoursToolContext) {
        const legacyContext = await dependencies.hoursToolContext(userMessage);
        facilities = legacyContext ? [legacyContext] : [];
      }
    } catch (error) {
      console.error("Hours candidate retrieval failed:", error.message);
    }
  } else {
    ({ knowledge: candidates, officialResources, facilities }
      = await retrieveUnifiedEvidence(queryEmbedding, retrievalQuery, { database }));
  }

  const vectorScores = candidates.map(row => Number(row.similarity)).filter(Number.isFinite);
  const similarity = vectorScores.length ? Math.max(...vectorScores).toFixed(4) : null;
  const confidentRows = candidates.filter(isConfidentCandidate);
  if (confidentRows.length === 0 && facilities.length === 0 && officialResources.length === 0
    && trustedRelationships.length === 0 && !hoursResult && !diningMenuResult) {
    return withAction({ response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" }, "fallback");
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
    officialResources,
    recentTurns: context.recentTurns,
    allowClarification: canClarify(context),
    structuredEvidence: hoursResult,
    diningEvidence: diningMenuResult,
    trustedRelationships,
  });
  if (polished?.action === "clarify" && polished.response?.trim()) {
    const answeredContext = context.clarification
      ? {
          ...context,
          clarification: {
            ...context.clarification,
            exchanges: context.clarification.exchanges.map((exchange, index, all) =>
              index === all.length - 1 && !exchange.answer ? { ...exchange, answer: userMessage } : exchange),
          },
        }
      : context;
    const clarification = buildClarificationState(answeredContext, userMessage, polished.response);
    if (clarification) {
      return {
        response: polished.response.trim(), matched: true, sourceType: "clarification",
        action: "clarify", clarification,
      };
    }
  }
  if (polished?.diningMenuLink && confidentRows.length === 0 && officialResources.length === 0) {
    return withAction(diningMenuLinkResponse());
  }
  if (polished?.hoursLookup) {
    const requestedId = Number(polished.hoursLookup.facilityId);
    const facility = facilities.find(item => item.facilityId === requestedId)
      || (facilities.length === 1 && !Number.isInteger(requestedId) ? facilities[0] : null);
    const lookup = { ...polished.hoursLookup };
    delete lookup.facilityId;
    const hoursAnswer = facility ? await hoursToolResolver(facility, lookup) : null;
    if (hoursAnswer) {
      if (confidentRows.length === 0 && officialResources.length === 0) return withAction(hoursAnswer);
      polished = await polisher(userMessage, combinedKnowledge, {
        allowHoursTool: false, candidateIds, officialResources,
        recentTurns: context.recentTurns, allowClarification: false,
        structuredEvidence: hoursAnswer,
      });
    }
    if (!hoursAnswer && confidentRows.length === 0 && officialResources.length === 0) {
      return withAction({ response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" }, "fallback");
    }
    if (!hoursAnswer) polished = await polisher(userMessage, combinedKnowledge, {
      allowHoursTool: false, candidateIds, officialResources,
      recentTurns: context.recentTurns, allowClarification: false,
    });
    if (polished?.diningMenuLink) return diningMenuLinkResponse();
  }
  const selectedIds = Array.isArray(polished?.relevantCandidateIds)
    ? [...new Set(polished.relevantCandidateIds.map(Number))]
    : [];
  const allowedIds = new Set(candidateIds);
  const validKnowledgeSelection = selectedIds.every(id => Number.isInteger(id) && allowedIds.has(id));
  const selectedResourceIds = Array.isArray(polished?.officialResourceIds)
    ? [...new Set(polished.officialResourceIds.map(Number))]
    : [];
  const resourceById = new Map(officialResources.map(resource => [Number(resource.resourceId), resource]));
  const validResourceSelection = selectedResourceIds.every(id => resourceById.has(id));
  const selectedRelationshipIds = Array.isArray(polished?.structuredRelationshipIds)
    ? [...new Set(polished.structuredRelationshipIds)]
    : [];
  const allowedRelationshipIds = new Set(trustedRelationships.map(item => item.relationshipId));
  const validRelationshipSelection = selectedRelationshipIds.every(id => allowedRelationshipIds.has(id));
  const hasGrounding = selectedIds.length > 0 || selectedResourceIds.length > 0
    || selectedRelationshipIds.length > 0 || hoursResult || diningMenuResult;
  if (!polished?.answerable || !polished.response?.trim() || !hasGrounding
    || !validKnowledgeSelection || !validResourceSelection || !validRelationshipSelection) {
    return withAction({ response: FALLBACK_MESSAGE, matched: false, sourceType: "fallback" }, "fallback");
  }
  const selectedKnowledge = confidentRows.filter(row => selectedIds.includes(Number(row.id)));
  const selectedResources = selectedResourceIds.map(id => resourceById.get(id));
  return {
    response: polished.response.trim(), matched: true, similarity,
    sourceType: selectedResourceIds.length > 0 ? "unified" : "rag",
    action: "answer", clarification: null,
    knowledgeIds: selectedIds,
    sources: mergeSources(buildOfficialSources(selectedResources), buildKnowledgeSources(selectedKnowledge)),
  };
};
