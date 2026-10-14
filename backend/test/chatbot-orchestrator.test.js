import test from "node:test";
import assert from "node:assert/strict";
import {
  CHATBOT_FALLBACK_MESSAGE,
  orchestrateChatQuery,
} from "../src/services/chatbot-orchestrator.services.js";
import { createChatbotToolRegistry } from "../src/services/chatbot-tools.services.js";

const response = ({ toolCall, content, usage = { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }) => ({
  choices: [{
    message: toolCall ? {
      role: "assistant",
      content: null,
      tool_calls: [{
        id: toolCall.id,
        type: "function",
        function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments || {}) },
      }],
    } : { role: "assistant", content: JSON.stringify(content) },
  }],
  usage,
});

const mockClient = responses => {
  const calls = [];
  return {
    calls,
    chat: { completions: { create: async request => {
      calls.push(request);
      return responses.shift();
    } } },
  };
};

const noDeterministicMatch = [{ name: "none", run: async () => null }];
const silentLog = () => {};

test("a deterministic match short-circuits with zero LLM calls", async () => {
  const client = mockClient([]);
  const events = [];
  const expected = { response: "Hello!", matched: true, sourceType: "smalltalk" };
  const result = await orchestrateChatQuery("hello", {
    client,
    log: event => events.push(event),
    deterministicHandlers: [{ name: "smalltalk", run: async () => expected }],
    toolRegistry: [],
  });
  assert.deepEqual(result, expected);
  assert.equal(client.calls.length, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0].route, "deterministic");
  assert.equal(events[0].deterministicMatcher, "smalltalk");
  assert.deepEqual(events[0].toolsCalled, []);
});

test("the router can call a registered tool and return a grounded answer", async () => {
  const events = [];
  const client = mockClient([
    response({ toolCall: { id: "call-rag", name: "rag_search", arguments: { query: "campus jobs" } } }),
    response({ content: {
      answerable: true,
      response: "Use the campus employment portal.",
      usedToolCallIds: ["call-rag"],
      relevantCandidateIds: [7],
      officialResourceIds: [],
      structuredRelationshipIds: [],
    } }),
  ]);
  const tool = {
    name: "rag_search",
    definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
    execute: async () => ({
      useful: true,
      modelOutput: { found: true, knowledge: [{ id: 7, content: "Use the campus employment portal." }] },
      evidence: { knowledge: [{ id: 7, cleaned_content: "Use the campus employment portal." }] },
      similarityScores: [0.82],
      buildSources: () => [],
    }),
  };
  const result = await orchestrateChatQuery("Where can I find a campus job?", {
    client, log: event => events.push(event), deterministicHandlers: noDeterministicMatch, toolRegistry: [tool],
  });
  assert.equal(result.response, "Use the campus employment portal.");
  assert.deepEqual(result.knowledgeIds, [7]);
  assert.equal(result.similarity, "0.8200");
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].toolsCalled, ["rag_search"]);
  assert.equal(events[0].loopDepth, 1);
  assert.deepEqual(events[0].similarityScores, [0.82]);
  assert.equal(events[0].tokenUsage[0].stage, "router");
  assert.equal(events[0].tokenUsage[1].stage, "final_answer");
});

test("a second tool request reaches the hard cap and forces the fallback", async () => {
  const client = mockClient([
    response({ toolCall: { id: "call-1", name: "rag_search", arguments: { query: "unknown" } } }),
    response({ toolCall: { id: "call-2", name: "rag_search", arguments: { query: "still unknown" } } }),
  ]);
  const tool = {
    name: "rag_search",
    definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
    execute: async () => ({ useful: false, modelOutput: { found: false } }),
  };
  const result = await orchestrateChatQuery("Unknown question", {
    client, log: silentLog, deterministicHandlers: noDeterministicMatch, toolRegistry: [tool],
  });
  assert.equal(client.calls.length, 2);
  assert.equal(result.response, CHATBOT_FALLBACK_MESSAGE);
  assert.equal(result.matched, false);
});

test("disabled web search is never offered to the router", async () => {
  assert.deepEqual(
    createChatbotToolRegistry({ webSearchEnabled: false }).map(tool => tool.name),
    ["rag_search", "facility_hours"],
  );
  const client = mockClient([
    response({ toolCall: { id: "call-rag", name: "rag_search", arguments: { query: "unknown" } } }),
    response({ content: {
      answerable: false, response: "", usedToolCallIds: [], relevantCandidateIds: [],
      officialResourceIds: [], structuredRelationshipIds: [],
    } }),
  ]);
  const tool = {
    name: "rag_search",
    definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
    execute: async () => ({ useful: false, modelOutput: { found: false } }),
  };
  await orchestrateChatQuery("Unknown question", {
    client, log: silentLog, deterministicHandlers: noDeterministicMatch, toolRegistry: [tool],
  });
  assert.deepEqual(client.calls[0].tools.map(item => item.function.name), ["rag_search"]);
});

test("a tool error degrades to the fallback instead of throwing", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const client = mockClient([
      response({ toolCall: { id: "call-rag", name: "rag_search", arguments: { query: "campus fact" } } }),
    ]);
    const tool = {
      name: "rag_search",
      definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
      execute: async () => { throw new Error("retrieval unavailable"); },
    };
    const result = await orchestrateChatQuery("Campus fact", {
      client, log: silentLog, deterministicHandlers: noDeterministicMatch, toolRegistry: [tool],
    });
    assert.equal(result.response, CHATBOT_FALLBACK_MESSAGE);
    assert.equal(result.matched, false);
  } finally {
    console.error = originalError;
  }
});

test("a router-selected standalone hours result returns the authoritative answer directly", async () => {
  const authoritative = {
    response: "The Activity Center closes at 9:00 PM.",
    matched: true,
    sourceType: "hours",
  };
  const client = mockClient([
    response({ toolCall: {
      id: "call-hours",
      name: "facility_hours",
      arguments: {
        facilityName: "Activity Center",
        intent: "closing_time",
        day: "2026-10-14",
        specialEvent: null,
        answerMode: "direct",
      },
    } }),
  ]);
  const tool = {
    name: "facility_hours",
    definition: { type: "function", function: { name: "facility_hours", parameters: { type: "object" } } },
    execute: async () => ({
      useful: true,
      modelOutput: { found: true, authoritativeHoursResult: authoritative.response, answerMode: "direct" },
      evidence: { hours: authoritative },
      directResponse: authoritative,
    }),
  };
  const result = await orchestrateChatQuery("What time does the Activity Center close?", {
    client, log: silentLog, deterministicHandlers: noDeterministicMatch, toolRegistry: [tool],
  });
  assert.deepEqual(result, authoritative);
  assert.equal(client.calls.length, 1);
});

test("a mixed hours request cannot return direct and composes with another tool result", async () => {
  const client = mockClient([
    response({ toolCall: {
      id: "call-hours",
      name: "facility_hours",
      arguments: {
        facilityName: "Activity Center",
        intent: "closing_time",
        day: "2026-10-14",
        specialEvent: null,
        answerMode: "direct",
      },
    } }),
    response({ toolCall: {
      id: "call-rag",
      name: "rag_search",
      arguments: { query: "Activity Center crowded tonight" },
    } }),
    response({ content: {
      answerable: true,
      response: "The Activity Center closes at 9:00 PM, and students report it is busiest after 6:00 PM.",
      usedToolCallIds: ["call-hours", "call-rag"],
      relevantCandidateIds: [44],
      officialResourceIds: [],
      structuredRelationshipIds: [],
    } }),
  ]);
  const tools = [{
    name: "facility_hours",
    definition: { type: "function", function: { name: "facility_hours", parameters: { type: "object" } } },
    execute: async args => ({
      useful: true,
      modelOutput: { found: true, authoritativeHoursResult: "The Activity Center closes at 9:00 PM.", answerMode: args.answerMode },
      evidence: { hours: { response: "The Activity Center closes at 9:00 PM." } },
      directResponse: { response: "The Activity Center closes at 9:00 PM.", matched: true, sourceType: "hours" },
    }),
  }, {
    name: "rag_search",
    definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
    execute: async () => ({
      useful: true,
      modelOutput: { found: true, knowledge: [{ id: 44, content: "The Activity Center is busiest after 6 PM." }] },
      evidence: { knowledge: [{ id: 44, cleaned_content: "The Activity Center is busiest after 6 PM." }] },
      similarityScores: [0.91],
      buildSources: () => [],
    }),
  }];
  const result = await orchestrateChatQuery(
    "When does the Activity Center close, and is it crowded tonight?",
    { client, log: silentLog, deterministicHandlers: noDeterministicMatch, toolRegistry: tools },
  );
  assert.match(result.response, /closes at 9:00 PM/);
  assert.match(result.response, /busiest after 6:00 PM/);
  assert.deepEqual(result.knowledgeIds, [44]);
  assert.equal(client.calls.length, 3);
  assert.match(
    client.calls[1].messages.find(message => message.tool_call_id === "call-hours").content,
    /directModeRejected/,
  );
  assert.equal("tools" in client.calls[2], false);
});
