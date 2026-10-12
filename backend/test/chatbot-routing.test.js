import test from "node:test";
import assert from "node:assert/strict";
import { buildFacilityCatalog, handleChatQuery } from "../src/services/chatbot.services.js";

test("groups facility aliases into the AI hours-tool catalog", () => {
  assert.deepEqual(buildFacilityCatalog([
    { id: 4, name: "Starbucks", normalized_alias: "starbucks" },
    { id: 4, name: "Starbucks", normalized_alias: "starbucks coffee" },
  ]), [{
    facilityId: 4,
    facilityName: "Starbucks",
    aliases: ["starbucks", "starbucks coffee"],
  }]);
});

test("a structured hours answer skips embedding, vector search, and polishing", async () => {
  const expected = { response: "Scheduled hours", matched: true, sourceType: "hours" };
  const fail = async () => { throw new Error("AI or RAG should not run"); };
  const result = await handleChatQuery("Is the AC open right now?", {
    hoursHandler: async () => expected,
    embedding: fail,
    database: { query: fail },
    polisher: fail,
  });
  assert.equal(result, expected);
});

test("a dining menu question returns the official link without AI or retrieval", async () => {
  const fail = async () => { throw new Error("Hours, AI, and RAG should not run"); };
  const result = await handleChatQuery("What is Schulze serving right now?", {
    facilityDictionary: async () => [
      { id: 2, name: "Schulze Dining Hall", normalized_alias: "schulze" },
    ],
    hoursHandler: fail,
    embedding: fail,
    database: { query: fail },
    polisher: fail,
  });
  assert.equal(result.sourceType, "dining_link");
  assert.equal(result.matched, true);
  assert.equal(result.sources[0].url, "https://ulm.mydininghub.com/en/location/schulze");
});

test("the AI can route an unusually worded dining request to the fixed official link", async () => {
  const result = await handleChatQuery("Can I grab something to eat at Schulze today?", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    retriever: async () => [],
    facilityCatalog: async () => [{ facilityId: 2, facilityName: "Schulze Dining Hall", aliases: ["caf"] }],
    polisher: async () => ({ answerable: false, response: "", diningMenuLink: true }),
  });
  assert.equal(result.sourceType, "dining_link");
  assert.equal(result.matched, true);
  assert.equal(result.sources[0].url, "https://ulm.mydininghub.com/en/location/schulze");
});

test("an uncertain question falls through to the existing RAG flow", async () => {
  let embedded = false;
  let polished = false;
  const result = await handleChatQuery("Tell me about campus", {
    hoursHandler: async () => null,
    embedding: async () => { embedded = true; return [0.1, 0.2]; },
    database: { query: async () => ({ rows: [{ id: 1, cleaned_content: "Verified fact", similarity: 0.9 }] }) },
    hoursToolContext: async () => null,
    polisher: async () => { polished = true; return { answerable: true, response: "Helpful answer", relevantCandidateIds: [1] }; },
  });
  assert.equal(embedded, true);
  assert.equal(polished, true);
  assert.equal(result.sourceType, "rag");
  assert.equal(result.response, "Helpful answer");
  assert.deepEqual(result.knowledgeIds, [1]);
});

test("uses an alias-expanded copy for retrieval but preserves the original question for answering", async () => {
  let embeddedQuery;
  let retrievedQuery;
  let polishedQuery;
  const original = "where is the caf";
  const expanded = "where is the caf Schulze Dining Hall";
  const result = await handleChatQuery(original, {
    hoursHandler: async () => null,
    aliasExpander: async query => {
      assert.equal(query, original);
      return expanded;
    },
    embedding: async query => { embeddedQuery = query; return [0.1]; },
    retriever: async (_embedding, query) => {
      retrievedQuery = query;
      return [{ id: 1, cleaned_content: "Schulze Dining Hall is on campus.", similarity: 0.9 }];
    },
    hoursToolContext: async () => null,
    polisher: async query => {
      polishedQuery = query;
      return { answerable: true, response: "The caf is Schulze Dining Hall.", relevantCandidateIds: [1] };
    },
  });

  assert.equal(embeddedQuery, expanded);
  assert.equal(retrievedQuery, expanded);
  assert.equal(polishedQuery, original);
  assert.equal(result.sourceType, "rag");
});

test("does not pollute a short self-contained retrieval query with persisted chat history", async () => {
  let retrievedQuery;
  const query = "where can i get on campus jobs?";
  const result = await handleChatQuery(query, {
    hoursHandler: async () => null,
    aliasExpander: async value => value,
    embedding: async () => [0.1],
    retriever: async (_embedding, value) => {
      retrievedQuery = value;
      return [{ id: 9, cleaned_content: "Students can find jobs through Handshake.", similarity: 0.9 }];
    },
    hoursToolContext: async () => null,
    polisher: async () => ({
      action: "answer", answerable: true, response: "Use Handshake.", relevantCandidateIds: [9],
    }),
  }, {
    recentTurns: [
      { role: "user", content: "Where is the Honors Lounge?" },
      { role: "assistant", content: "It is in Strauss Hall." },
    ],
  });

  assert.equal(retrievedQuery, query);
  assert.equal(result.response, "Use Handshake.");
});

test("continues with the original query when alias expansion is unavailable", async () => {
  let embeddedQuery;
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await handleChatQuery("campus question", {
      hoursHandler: async () => null,
      aliasExpander: async () => { throw new Error("alias store unavailable"); },
      embedding: async query => { embeddedQuery = query; return [0.1]; },
      retriever: async () => [],
      hoursToolContext: async () => null,
    });
    assert.equal(embeddedQuery, "campus question");
    assert.equal(result.sourceType, "fallback");
  } finally {
    console.error = originalError;
  }
});

test("an unanswerable retrieved match uses the HawkWall fallback", async () => {
  const result = await handleChatQuery("Is dining open during Fall Break?", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    database: { query: async () => ({ rows: [{ id: 1, cleaned_content: "Dining serves lunch daily", similarity: 0.9 }] }) },
    hoursToolContext: async () => null,
    polisher: async () => ({ answerable: false, response: "" }),
  });
  assert.deepEqual(result, {
    response: "I don't have the answer to that yet. Try posting this question on the HawkWall and another student can answer you!",
    matched: false,
    sourceType: "fallback",
  });
});

test("the original honest fallback remains when RAG has no confident match", async () => {
  const result = await handleChatQuery("Unknown question", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    database: { query: async () => ({ rows: [] }) },
    hoursToolContext: async () => null,
    polisher: async () => { throw new Error("Polisher should not run"); },
  });
  assert.equal(result.matched, false);
  assert.equal(result.sourceType, "fallback");
  assert.equal(
    result.response,
    "I don't have the answer to that yet. Try posting this question on the HawkWall and another student can answer you!",
  );
});

test("the existing RAG model call can recover a missed structured-hours question", async () => {
  const facility = { facilityId: 4, facilityName: "Dining" };
  const expected = { response: "Dining is open until 8:00 PM.", matched: true, sourceType: "hours" };
  let resolverArguments;
  const result = await handleChatQuery("Can I use Dining right now?", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    database: { query: async () => ({ rows: [] }) },
    hoursToolContext: async () => facility,
    polisher: async (_query, _knowledge, options) => {
      assert.equal(options.facility, facility);
      return { answerable: false, response: "", hoursLookup: { intent: "open_now", date: null, specialEvent: null } };
    },
    hoursToolResolver: async (...args) => { resolverArguments = args; return expected; },
  });
  assert.equal(result, expected);
  assert.deepEqual(resolverArguments, [facility, { intent: "open_now", date: null, specialEvent: null }]);
});

test("the AI can recover a misspelled facility and prioritize its structured schedule", async () => {
  const starbucks = { facilityId: 4, facilityName: "Starbucks", aliases: ["starbucks"] };
  const expected = { response: "Starbucks is open until 6:00 PM.", matched: true, sourceType: "hours" };
  let resolverArguments;
  const result = await handleChatQuery("is starbuck open rn", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    retriever: async () => [],
    facilityCatalog: async () => [starbucks],
    polisher: async (_query, knowledge, options) => {
      assert.equal(knowledge, "[]");
      assert.deepEqual(options.facilities, [starbucks]);
      return {
        answerable: false,
        response: "",
        hoursLookup: { facilityId: 4, intent: "open_now", date: null, specialEvent: null },
      };
    },
    hoursToolResolver: async (...args) => { resolverArguments = args; return expected; },
  });
  assert.equal(result, expected);
  assert.deepEqual(resolverArguments, [
    starbucks,
    { intent: "open_now", date: null, specialEvent: null },
  ]);
});

test("a failed generalized hours lookup falls through to grounded RAG", async () => {
  const starbucks = { facilityId: 4, facilityName: "Starbucks", aliases: ["starbucks"] };
  let calls = 0;
  const result = await handleChatQuery("starbuck hours during an unknown event", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    retriever: async () => [{ id: 8, cleaned_content: "Verified alternate hours", similarity: 0.9 }],
    facilityCatalog: async () => [starbucks],
    polisher: async (_query, _knowledge, options) => {
      calls += 1;
      return options.allowHoursTool
        ? {
            answerable: false,
            response: "",
            hoursLookup: { facilityId: 4, intent: "weekly_hours", date: null, specialEvent: "Unknown Event" },
          }
        : { answerable: true, response: "Grounded alternate hours", relevantCandidateIds: [8] };
    },
    hoursToolResolver: async () => null,
  });
  assert.equal(calls, 2);
  assert.equal(result.response, "Grounded alternate hours");
  assert.equal(result.sourceType, "rag");
});

test("a failed hours tool lookup resumes grounded RAG answering", async () => {
  let calls = 0;
  const result = await handleChatQuery("Dining during an unknown event", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    database: { query: async () => ({ rows: [{ id: 1, cleaned_content: "Verified dining fact", similarity: 0.9 }] }) },
    hoursToolContext: async () => ({ facilityId: 4, facilityName: "Dining" }),
    polisher: async (_query, _knowledge, options) => {
      calls += 1;
      return options.allowHoursTool
        ? { answerable: false, response: "", hoursLookup: { intent: "weekly_hours", date: null, specialEvent: "Unknown Event" } }
        : { answerable: true, response: "Grounded RAG answer", relevantCandidateIds: [1] };
    },
    hoursToolResolver: async () => null,
  });
  assert.equal(calls, 2);
  assert.equal(result.response, "Grounded RAG answer");
  assert.equal(result.sourceType, "rag");
});

test("passes all confident candidates from the expanded retrieval pool to the existing AI call", async () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    cleaned_content: `Candidate ${index + 1}`,
    similarity: 0.9 - index * 0.01,
    approved_at: "2026-01-01T12:00:00.000Z",
    last_verified_at: "2026-08-01T12:00:00.000Z",
  }));
  let receivedKnowledge;
  const result = await handleChatQuery("Broad campus question", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    retriever: async () => candidates,
    hoursToolContext: async () => null,
    polisher: async (_query, knowledge, options) => {
      receivedKnowledge = knowledge;
      assert.deepEqual(options.candidateIds, candidates.map(candidate => candidate.id));
      return { answerable: true, response: "Grounded answer", relevantCandidateIds: [1, 10] };
    },
  });
  const parsedKnowledge = JSON.parse(receivedKnowledge);
  assert.equal(parsedKnowledge.length, 10);
  assert.deepEqual(parsedKnowledge[0], {
    id: 1,
    content: "Candidate 1",
    approvedAt: "2026-01-01T12:00:00.000Z",
    lastVerifiedAt: "2026-08-01T12:00:00.000Z",
  });
  assert.deepEqual(parsedKnowledge[9], {
    id: 10,
    content: "Candidate 10",
    approvedAt: "2026-01-01T12:00:00.000Z",
    lastVerifiedAt: "2026-08-01T12:00:00.000Z",
  });
  assert.equal(result.response, "Grounded answer");
  assert.deepEqual(result.knowledgeIds, [1, 10]);
});

test("keeps an exact full-text candidate even when its vector similarity is below threshold", async () => {
  let receivedKnowledge;
  const result = await handleChatQuery("Where is Banner?", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    retriever: async () => [{
      id: 7,
      cleaned_content: "Banner is the student information system.",
      similarity: 0.31,
      vector_rank: 9,
      text_rank: 1,
    }],
    hoursToolContext: async () => null,
    polisher: async (_query, knowledge) => {
      receivedKnowledge = knowledge;
      return { answerable: true, response: "Banner is the student information system.", relevantCandidateIds: [7] };
    },
  });
  assert.match(receivedKnowledge, /Banner/);
  assert.equal(result.sourceType, "rag");
});

test("rejects an answer that cites a candidate outside the retrieved pool", async () => {
  const result = await handleChatQuery("Campus question", {
    hoursHandler: async () => null,
    embedding: async () => [0.1],
    retriever: async () => [{ id: 3, cleaned_content: "Retrieved fact", similarity: 0.9 }],
    hoursToolContext: async () => null,
    polisher: async () => ({
      answerable: true,
      response: "Unsupported answer",
      relevantCandidateIds: [999],
    }),
  });
  assert.equal(result.matched, false);
  assert.equal(result.sourceType, "fallback");
});

test("a direct resource request uses unified selection instead of bypassing RAG", async () => {
  let embedded = false;
  const resource = {
    resourceId: 12, slug: "employee-directory", name: "ULM employee directory",
    description: "Faculty and staff contacts", url: "https://ulmapps.ulm.edu/search/index.php?tab=1",
    responseText: "Search the official directory.", aliases: ["professor email", "employee directory"], priority: 90,
  };
  const result = await handleChatQuery("Where can I find my professor's email?", {
    hoursHandler: async () => null,
    resourceCatalog: async () => [resource],
    embedding: async () => { embedded = true; return [0.1]; },
    retriever: async () => [],
    facilityCatalog: async () => [],
    polisher: async (_query, _knowledge, options) => {
      assert.deepEqual(options.officialResources, [resource]);
      return {
        action: "answer", answerable: true, response: "Search the official directory.",
        relevantCandidateIds: [], officialResourceIds: [12],
      };
    },
  });
  assert.equal(embedded, true);
  assert.equal(result.sourceType, "unified");
  assert.equal(result.sources[0].url, resource.url);
});

test("a request for a physical service keeps the RAG answer and its official source", async () => {
  const resource = {
    resourceId: 21, slug: "warhawk-id", name: "ULM Warhawk ID Services",
    url: "https://www.ulm.edu/warhawkcard/id-card-info.html",
    responseText: "Visit Warhawk ID Services.", aliases: ["student id card"], priority: 90,
  };
  const result = await handleChatQuery("Where can I get a new student ID card?", {
    hoursHandler: async () => null,
    resourceCatalog: async () => [resource],
    embedding: async () => [0.1],
    retriever: async () => [{
      id: 8,
      cleaned_content: "Warhawk ID Services issues new and replacement student ID cards.",
      similarity: 0.9,
      source_url: resource.url,
      source_title: resource.name,
    }],
    facilityCatalog: async () => [],
    polisher: async () => ({
      answerable: true,
      response: "Get the card through Warhawk ID Services.",
      relevantCandidateIds: [8],
    }),
  });
  assert.equal(result.sourceType, "rag");
  assert.match(result.response, /Warhawk ID Services/);
  assert.equal(result.sources[0].type, "official");
  assert.equal(result.sources[0].url, resource.url);
});

test("the AI may select only a resource from the backend catalog", async () => {
  const resource = {
    resourceId: 20, slug: "library", name: "ULM Library", description: "Research help",
    url: "https://www.ulm.edu/library/", responseText: "Use the library website.", aliases: ["research guide"],
  };
  const result = await handleChatQuery("I need scholarly sources for my paper", {
    hoursHandler: async () => null,
    resourceCatalog: async () => [resource],
    embedding: async () => [0.1],
    retriever: async () => [],
    facilityCatalog: async () => [],
    polisher: async (_query, _knowledge, options) => {
      assert.deepEqual(options.officialResources, [resource]);
      return {
        action: "answer", answerable: true, response: "Use the library website.",
        relevantCandidateIds: [], officialResourceIds: [20],
      };
    },
  });
  assert.equal(result.sourceType, "unified");
  assert.equal(result.sources[0].url, resource.url);
});

test("a grounded answer cites every selected HawkWall discussion and no unselected candidate", async () => {
  const result = await handleChatQuery("Where can I find campus jobs?", {
    hoursHandler: async () => null,
    resourceCatalog: async () => [],
    embedding: async () => [0.1],
    retriever: async () => [
      {
        id: 1, cleaned_content: "Use the employment portal.", similarity: 0.9,
        source_post_id: 52, source_parent_id: 40, source_post_content: "Try the employment portal.",
        thread_title: "How do students find campus jobs?", source_approval_count: 8,
      },
      {
        id: 2, cleaned_content: "Ask individual departments.", similarity: 0.85,
        source_post_id: 61, source_parent_id: 41, source_post_content: "Some departments post separately.",
        thread_title: "Department job listings", source_approval_count: 6,
      },
      {
        id: 3, cleaned_content: "Unselected result.", similarity: 0.8,
        source_post_id: 70, source_post_content: "Do not cite this.",
      },
    ],
    facilityCatalog: async () => [],
    polisher: async () => ({
      answerable: true,
      response: "There are two reported paths.",
      relevantCandidateIds: [1, 2],
    }),
  });
  assert.deepEqual(result.sources.map(source => source.url), [
    "/sources/hawkwall/52",
    "/sources/hawkwall/61",
  ]);
  assert.deepEqual(result.sources.map(source => source.approvalCount), [8, 6]);
});

test("one grounded answer can select both an official resource and HawkWall evidence", async () => {
  const official = {
    resourceId: 12,
    name: "ULM Career Development and Handshake",
    description: "Jobs, internships, and campus employment guidance",
    url: "https://www.ulm.edu/careerdevelopment/careerservices/handshake.html",
    lastVerifiedAt: "2026-10-01T00:00:00.000Z",
  };
  const result = await handleChatQuery("Where can I find an on-campus job?", {
    hoursHandler: async () => null,
    aliasExpander: async query => query,
    embedding: async () => [0.1],
    unifiedRetriever: async () => ({
      knowledge: [{
        id: 31,
        cleaned_content: "Some departments advertise student jobs directly.",
        similarity: 0.9,
        source_post_id: 82,
        source_parent_id: 70,
        source_post_content: "Ask departments about positions that are not listed centrally.",
        thread_title: "Finding jobs on campus",
        source_approval_count: 7,
      }],
      officialResources: [official],
      facilities: [],
    }),
    polisher: async (_query, _knowledge, options) => {
      assert.deepEqual(options.candidateIds, [31]);
      assert.deepEqual(options.officialResources, [official]);
      return {
        action: "answer",
        answerable: true,
        response: "Use Handshake, and also check directly with departments.",
        relevantCandidateIds: [31],
        officialResourceIds: [12],
      };
    },
  });

  assert.equal(result.sourceType, "unified");
  assert.deepEqual(result.knowledgeIds, [31]);
  assert.deepEqual(result.sources.map(source => source.type), ["official", "hawkwall"]);
  assert.deepEqual(result.sources.map(source => source.url), [
    official.url,
    "/sources/hawkwall/82",
  ]);
});

test("a mixed hours question continues to one synthesis call with structured and HawkWall evidence", async () => {
  const hoursEvidence = {
    response: "The Activity Center closes at 9:00 PM.",
    matched: true,
    sourceType: "hours",
  };
  let synthesisCalls = 0;
  const result = await handleChatQuery("When does the AC close, and is it crowded after six?", {
    hoursHandler: async () => hoursEvidence,
    diningMenuHandler: async () => null,
    aliasExpander: async query => query,
    embedding: async () => [0.1],
    unifiedRetriever: async () => ({
      knowledge: [{
        id: 44,
        cleaned_content: "Students report that the Activity Center is busiest after 6 PM.",
        similarity: 0.91,
        source_post_id: 91,
        source_post_content: "It gets busy after six on weekdays.",
        thread_title: "Activity Center crowding",
      }],
      officialResources: [],
      facilities: [{ facilityId: 3, facilityName: "Activity Center" }],
    }),
    polisher: async (_query, _knowledge, options) => {
      synthesisCalls += 1;
      assert.equal(options.structuredEvidence, hoursEvidence);
      return {
        action: "answer",
        answerable: true,
        response: "It closes at 9 PM, and students say it is busiest after six.",
        relevantCandidateIds: [44],
        officialResourceIds: [],
      };
    },
  });

  assert.equal(synthesisCalls, 1);
  assert.equal(result.action, "answer");
  assert.match(result.response, /closes at 9 PM/);
  assert.deepEqual(result.knowledgeIds, [44]);
  assert.equal(result.sources[0].url, "/sources/hawkwall/91");
});
