import test from "node:test";
import assert from "node:assert/strict";
import {
  CHATBOT_FALLBACK_MESSAGE,
  orchestrateChatQuery,
} from "../src/services/chatbot-orchestrator.services.js";
import { createChatbotToolRegistry } from "../src/services/chatbot-tools.services.js";

const response = ({ toolCall, toolCalls, content, usage = { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }) => ({
  choices: [{
    message: toolCall || toolCalls ? {
      role: "assistant",
      content: null,
      tool_calls: (toolCalls || [toolCall]).map(call => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) },
      })),
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
    ["rag_search", "facility_hours", "dining_menu"],
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
  assert.equal(client.calls[1].tool_choice, "required");
  assert.deepEqual(client.calls[1].tools.map(item => item.function.name), ["facility_hours", "rag_search"]);
  assert.match(
    client.calls[1].messages.find(message => message.tool_call_id === "call-hours").content,
    /directModeRejected/,
  );
  assert.equal("tools" in client.calls[2], false);
});

test("a router-selected standalone dining menu result returns the fixed response directly", async () => {
  const client = mockClient([
    response({ toolCall: {
      id: "call-menu",
      name: "dining_menu",
      arguments: { answerMode: "direct" },
    } }),
  ]);
  const menuTool = createChatbotToolRegistry({ webSearchEnabled: false })
    .find(tool => tool.name === "dining_menu");

  const result = await orchestrateChatQuery("What is Schulze serving?", {
    client,
    log: silentLog,
    deterministicHandlers: noDeterministicMatch,
    toolRegistry: [menuTool],
  });

  assert.equal(result.sourceType, "dining_link");
  assert.match(result.sources[0].url, /ulm\.mydininghub\.com\/en\/location\/schulze/);
  assert.equal(client.calls.length, 1);
});

test("mixed Schulze hours and menu questions compose both authoritative tool results", async () => {
  const client = mockClient([
    response({ toolCall: {
      id: "call-hours",
      name: "facility_hours",
      arguments: {
        facilityName: "Schulze Dining Hall",
        intent: "open_now",
        day: "2026-10-14",
        specialEvent: null,
        answerMode: "compose",
      },
    } }),
    response({ toolCall: {
      id: "call-menu",
      name: "dining_menu",
      arguments: { answerMode: "compose" },
    } }),
    response({ content: {
      answerable: true,
      response: "Schulze is open until 8:00 PM tonight. You can view the current menu [here](https://ulm.mydininghub.com/en/location/schulze).",
      usedToolCallIds: ["call-hours", "call-menu"],
      relevantCandidateIds: [],
      officialResourceIds: [],
      structuredRelationshipIds: [],
    } }),
  ]);
  const hoursTool = {
    name: "facility_hours",
    definition: { type: "function", function: { name: "facility_hours", parameters: { type: "object" } } },
    execute: async () => ({
      useful: true,
      modelOutput: { found: true, authoritativeHoursResult: "Schulze is open until 8:00 PM tonight.", answerMode: "compose" },
      evidence: { hours: { response: "Schulze is open until 8:00 PM tonight." } },
      directResponse: { response: "Schulze is open until 8:00 PM tonight.", matched: true, sourceType: "hours" },
      buildSources: () => [],
    }),
  };
  const menuTool = createChatbotToolRegistry({ webSearchEnabled: false })
    .find(tool => tool.name === "dining_menu");

  const result = await orchestrateChatQuery("Is Schulze open tonight, and what are they serving?", {
    client,
    log: silentLog,
    deterministicHandlers: noDeterministicMatch,
    toolRegistry: [hoursTool, menuTool],
  });

  assert.match(result.response, /open until 8:00 PM/);
  assert.match(result.response, /button below/);
  assert.doesNotMatch(result.response, /\[here\]|https:\/\//);
  assert.equal(result.sourceType, "dining_link");
  assert.match(result.sources[0].url, /ulm\.mydininghub\.com\/en\/location\/schulze/);
  assert.equal(client.calls.length, 3);
  assert.equal(client.calls[1].tool_choice, "required");
  assert.deepEqual(client.calls[1].tools.map(item => item.function.name), ["facility_hours", "dining_menu"]);
});

test("an unavailable hours result does not discard useful service evidence", async () => {
  for (const example of [
    { question: "Is the library open today, and what services does it offer?", subject: "Library", id: 71 },
    { question: "When does the SSC close, and what can it help me with?", subject: "SSC", id: 72 },
  ]) {
    const client = mockClient([
      response({ toolCall: {
        id: "call-hours",
        name: "facility_hours",
        arguments: {
          facilityName: example.subject,
          intent: "closing_time",
          day: "2026-10-14",
          specialEvent: null,
          answerMode: "compose",
        },
      } }),
      response({ toolCall: {
        id: "call-rag",
        name: "rag_search",
        arguments: { query: `${example.subject} services` },
      } }),
      response({ content: {
        answerable: true,
        response: `I couldn't verify today's hours. ${example.subject} provides documented student services.`,
        usedToolCallIds: ["call-hours", "call-rag"],
        relevantCandidateIds: [example.id],
        officialResourceIds: [],
        structuredRelationshipIds: [],
      } }),
    ]);
    const tools = [{
      name: "facility_hours",
      definition: { type: "function", function: { name: "facility_hours", parameters: { type: "object" } } },
      execute: async () => ({ useful: false, modelOutput: { found: false } }),
    }, {
      name: "rag_search",
      definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
      execute: async () => ({
        useful: true,
        modelOutput: { found: true, knowledge: [{ id: example.id, content: `${example.subject} provides documented student services.` }] },
        evidence: { knowledge: [{ id: example.id, cleaned_content: `${example.subject} provides documented student services.` }] },
        similarityScores: [0.88],
        buildSources: () => [],
      }),
    }];

    const result = await orchestrateChatQuery(example.question, {
      client,
      log: silentLog,
      deterministicHandlers: noDeterministicMatch,
      toolRegistry: tools,
    });

    assert.match(result.response, /couldn't verify today's hours/);
    assert.deepEqual(result.knowledgeIds, [example.id]);
    assert.equal(result.matched, true);
    assert.equal(client.calls[1].tool_choice, "required");
    assert.deepEqual(client.calls[1].tools.map(item => item.function.name), ["facility_hours", "rag_search"]);
  }
});

test("the router can plan two tools together and one failure does not discard the other result", async () => {
  const client = mockClient([
    response({ toolCalls: [{
      id: "call-hours",
      name: "facility_hours",
      arguments: {
        facilityName: "Library",
        intent: "open_now",
        day: "2026-10-14",
        specialEvent: null,
        answerMode: "compose",
      },
    }, {
      id: "call-rag",
      name: "rag_search",
      arguments: { query: "ULM Library services" },
    }] }),
    response({ content: {
      answerable: true,
      response: "I couldn't verify today's hours. The Library provides books, research databases, study rooms, and computer labs.",
      usedToolCallIds: ["call-hours", "call-rag"],
      relevantCandidateIds: [73],
      officialResourceIds: [],
      structuredRelationshipIds: [],
    } }),
  ]);
  const tools = [{
    name: "facility_hours",
    definition: { type: "function", function: { name: "facility_hours", parameters: { type: "object" } } },
    execute: async () => ({ useful: false, modelOutput: { found: false } }),
  }, {
    name: "rag_search",
    definition: { type: "function", function: { name: "rag_search", parameters: { type: "object" } } },
    execute: async () => ({
      useful: true,
      modelOutput: { found: true, knowledge: [{ id: 73, content: "The Library provides books, research databases, study rooms, and computer labs." }] },
      evidence: { knowledge: [{ id: 73, cleaned_content: "The Library provides books, research databases, study rooms, and computer labs." }] },
      similarityScores: [0.9],
      buildSources: () => [],
    }),
  }];

  const result = await orchestrateChatQuery("Is the library open today, and what services does it offer?", {
    client,
    log: silentLog,
    deterministicHandlers: noDeterministicMatch,
    toolRegistry: tools,
  });

  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].parallel_tool_calls, true);
  assert.match(result.response, /couldn't verify today's hours/);
  assert.match(result.response, /research databases/);
  assert.deepEqual(result.knowledgeIds, [73]);
});

test("the round limit does not limit how many needed tools can run in one round", async () => {
  const plannedCalls = [1, 2, 3].map(id => ({
    id: `call-${id}`,
    name: `tool_${id}`,
    arguments: {},
  }));
  const client = mockClient([
    response({ toolCalls: plannedCalls }),
    response({ content: {
      answerable: true,
      response: "Combined answer from three grounded tools.",
      usedToolCallIds: plannedCalls.map(call => call.id),
      relevantCandidateIds: [1, 2, 3],
      officialResourceIds: [],
      structuredRelationshipIds: [],
    } }),
  ]);
  const executionCounts = [0, 0, 0];
  const tools = [1, 2, 3].map(id => ({
    name: `tool_${id}`,
    definition: { type: "function", function: { name: `tool_${id}`, parameters: { type: "object" } } },
    execute: async () => {
      executionCounts[id - 1] += 1;
      return {
        useful: true,
        modelOutput: { found: true, knowledge: [{ id, content: `Fact ${id}` }] },
        evidence: { knowledge: [{ id, cleaned_content: `Fact ${id}` }] },
        buildSources: () => [],
      };
    },
  }));

  const result = await orchestrateChatQuery("Combine three campus facts", {
    client,
    log: silentLog,
    deterministicHandlers: noDeterministicMatch,
    toolRegistry: tools,
  });

  assert.deepEqual(executionCounts, [1, 1, 1]);
  assert.deepEqual(result.knowledgeIds, [1, 2, 3]);
  assert.equal(client.calls.length, 2);
});
