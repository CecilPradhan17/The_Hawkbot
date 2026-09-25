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
  assert.deepEqual(parsedKnowledge[0], { id: 1, content: "Candidate 1" });
  assert.deepEqual(parsedKnowledge[9], { id: 10, content: "Candidate 10" });
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
