import pool from "../db.js";
import { generateQueryEmbedding } from "./embedding.services.js";
import {
  buildKnowledgeSources,
  formatKnowledgeCandidates,
  isConfidentCandidate,
} from "./rag-retrieval.services.js";
import { retrieveUnifiedEvidence } from "./unified-retrieval.services.js";
import {
  expandCampusPlaceAliases,
  resolveCampusPlaceRelationships,
  resolveUniqueCampusFacility,
} from "./campus-place-alias.services.js";
import { getFacilityDictionary } from "./hours-repository.services.js";
import { resolveHoursToolLookup } from "./hours-chat.services.js";
import { diningMenuLinkResponse } from "./dining-menu-link.services.js";

const ragSearchDefinition = {
  type: "function",
  function: {
    name: "rag_search",
    description: "Search Hawkbot's approved ULM knowledge and reviewed official-resource directory.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A concise campus-information search query that preserves the student's intended subject.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const facilityHoursDefinition = {
  type: "function",
  function: {
    name: "facility_hours",
    description: "Look up authoritative structured operating hours for one ULM facility.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        facilityName: { type: "string", description: "The facility name or campus alias." },
        intent: {
          type: "string",
          enum: ["open_now", "opening_time", "closing_time", "hours_on_date", "weekly_hours"],
        },
        day: {
          type: ["string", "null"],
          description: "An ISO campus date in YYYY-MM-DD format, or null when the request has no specific date.",
        },
        specialEvent: {
          type: ["string", "null"],
          description: "A named period such as Fall Break, or null.",
        },
        answerMode: {
          type: "string",
          enum: ["direct", "compose"],
          description: "Use direct only when hours completely answer the request; use compose when another part also needs an answer.",
        },
      },
      required: ["facilityName", "intent", "day", "specialEvent", "answerMode"],
      additionalProperties: false,
    },
  },
};

const diningMenuDefinition = {
  type: "function",
  function: {
    name: "dining_menu",
    description: "Return Hawkbot's fixed official Schulze Dining Hall menu destination without fetching or summarizing live menu data.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        answerMode: {
          type: "string",
          enum: ["direct", "compose"],
          description: "Use direct only when the menu destination completely answers the request; use compose when another part also needs an answer.",
        },
      },
      required: ["answerMode"],
      additionalProperties: false,
    },
  },
};

const webSearchDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search approved ULM web domains for current or changing campus information, including news, announcements, events, calendars, deadlines, personnel/contact details, policy or fee changes, schedules, service status, and current official pages. May be called alongside any other relevant tool; do not use it when a structured tool fully owns the requested fact.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const officialSource = resource => ({
  type: "official",
  title: resource.name,
  url: resource.url,
  lastVerifiedAt: resource.lastVerifiedAt || null,
});

const createRagSearchTool = dependencies => ({
  name: "rag_search",
  definition: ragSearchDefinition,
  async execute({ query }) {
    const database = dependencies.database || pool;
    const embedding = dependencies.embedding || generateQueryEmbedding;
    const retrieve = dependencies.retrieveEvidence
      || ((queryEmbedding, queryText) => retrieveUnifiedEvidence(queryEmbedding, queryText, { database }));
    const dictionary = dependencies.facilityDictionary
      || (() => getFacilityDictionary(database));

    let expandedQuery = String(query || "").trim();
    let relationships = [];
    try {
      relationships = await resolveCampusPlaceRelationships(expandedQuery, { dictionary });
      expandedQuery = await expandCampusPlaceAliases(expandedQuery, { dictionary });
    } catch (error) {
      console.error("RAG alias expansion failed:", error.message);
    }

    if (!expandedQuery) return { useful: false, modelOutput: { found: false }, similarityScores: [] };
    const queryEmbedding = await embedding(expandedQuery);
    const retrieved = await retrieve(queryEmbedding, expandedQuery);
    const knowledge = (retrieved.knowledge || []).filter(isConfidentCandidate);
    const officialResources = retrieved.officialResources || [];
    const similarityScores = (retrieved.knowledge || [])
      .map(candidate => Number(candidate.similarity))
      .filter(Number.isFinite);

    return {
      useful: knowledge.length > 0 || officialResources.length > 0 || relationships.length > 0,
      similarityScores,
      modelOutput: {
        found: knowledge.length > 0 || officialResources.length > 0 || relationships.length > 0,
        knowledge: JSON.parse(formatKnowledgeCandidates(knowledge)),
        officialResources: officialResources.map(resource => ({
          resourceId: Number(resource.resourceId),
          name: resource.name,
          description: resource.description,
        })),
        trustedRelationships: relationships.map(relationship => ({
          relationshipId: relationship.relationshipId,
          statement: relationship.statement,
        })),
      },
      evidence: { knowledge, officialResources, relationships },
      buildSources(selection) {
        const selectedKnowledge = knowledge.filter(candidate =>
          selection.knowledgeIds.includes(Number(candidate.id)));
        const selectedResources = officialResources.filter(resource =>
          selection.resourceIds.includes(Number(resource.resourceId)));
        return [
          ...selectedResources.map(officialSource),
          ...buildKnowledgeSources(selectedKnowledge),
        ];
      },
    };
  },
});

const createFacilityHoursTool = dependencies => ({
  name: "facility_hours",
  definition: facilityHoursDefinition,
  async execute({ facilityName, intent, day, specialEvent, answerMode }) {
    const database = dependencies.database || pool;
    const dictionary = dependencies.facilityDictionary
      || (() => getFacilityDictionary(database));
    const facility = await resolveUniqueCampusFacility(facilityName, { dictionary });
    if (!facility) return { useful: false, modelOutput: { found: false } };

    const resolver = dependencies.hoursResolver || resolveHoursToolLookup;
    const answer = await resolver(
      { facilityId: facility.id, facilityName: facility.name },
      { intent, date: day, specialEvent },
    );
    if (!answer) return { useful: false, modelOutput: { found: false } };
    return {
      useful: true,
      modelOutput: {
        found: true,
        facilityName: facility.name,
        authoritativeHoursResult: answer.response,
        answerMode,
      },
      evidence: { hours: answer },
      directResponse: answer,
      buildSources: () => answer.sources || [],
    };
  },
});

const createDiningMenuTool = () => ({
  name: "dining_menu",
  definition: diningMenuDefinition,
  async execute({ answerMode }) {
    const answer = diningMenuLinkResponse();
    return {
      useful: true,
      modelOutput: {
        found: true,
        authoritativeMenuResult: answer.response,
        officialMenuUrl: answer.sources[0].url,
        answerMode,
      },
      evidence: { diningMenu: answer },
      directResponse: answer,
      buildSources: () => answer.sources,
    };
  },
});

const createWebSearchTool = () => ({
  name: "web_search",
  definition: webSearchDefinition,
  async execute() {
    // TODO: Search only a reviewed ULM-domain allowlist. Return bounded excerpts
    // and canonical source URLs; never return fetched markup or execute page content.
    return { useful: false, modelOutput: { found: false, status: "not_implemented" } };
  },
});

export const createChatbotToolRegistry = (dependencies = {}) => {
  const tools = [
    createRagSearchTool(dependencies),
    createFacilityHoursTool(dependencies),
    createDiningMenuTool(),
  ];
  const webSearchEnabled = dependencies.webSearchEnabled
    ?? String(process.env.WEB_SEARCH_ENABLED || "false").toLowerCase() === "true";
  if (webSearchEnabled) tools.push(createWebSearchTool());
  return tools;
};
