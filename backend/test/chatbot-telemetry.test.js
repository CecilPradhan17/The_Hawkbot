import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChatbotTelemetry,
  calculateChatbotCost,
  classifyChatQuery,
  recordChatbotTelemetry,
} from "../src/services/chatbot-telemetry.services.js";

test("classifies questions without retaining their text", () => {
  const question = "When is registration for Spring 2027?";
  const telemetry = buildChatbotTelemetry({
    question,
    event: {
      route: "router",
      outcome: "answered",
      deterministicMatcher: null,
      toolExecutions: [],
      tokenUsage: [],
      latencyMs: { total: 25 },
    },
  });

  assert.equal(classifyChatQuery(question), "academic_calendar");
  assert.equal(telemetry.queryCategory, "academic_calendar");
  assert.equal(JSON.stringify(telemetry).includes(question), false);
  assert.equal("userId" in telemetry, false);
  assert.match(telemetry.requestId, /^[0-9a-f-]{36}$/);
});

test("calculates model tokens and every web search call", () => {
  const result = calculateChatbotCost({
    tokenUsage: [
      { stage: "router", model: "gpt-4o-mini", inputTokens: 1_000, outputTokens: 100 },
      { stage: "web_search", model: "gpt-5.5-2026-04-23", inputTokens: 2_000, outputTokens: 200 },
      { stage: "rag_search", model: "text-embedding-3-large", inputTokens: 100, outputTokens: 0 },
    ],
    webSearchCalls: 2,
  });

  assert.equal(result.breakdown.at(-1).calls, 2);
  assert.ok(Math.abs(result.estimatedCostUsd - 0.036223) < 0.000000001);
});

test("persists only privacy-safe telemetry fields", async () => {
  const calls = [];
  const database = { query: async (...args) => calls.push(args) };
  const telemetry = {
    requestId: "7f66da1f-4ca7-4b4e-99c4-6ff35a551358",
    queryCategory: "campus_information",
    route: "router",
    outcome: "answered",
    deterministicMatcher: null,
    tools: [{ name: "rag_search", useful: true, error: false, webSearchCalls: 0 }],
    tokenUsage: [{ stage: "router", model: "gpt-4o-mini", inputTokens: 10, outputTokens: 2 }],
    webSearchCalls: 0,
    estimatedCostUsd: 0.0000027,
    pricingVersion: "2026-10-16",
    costBreakdown: [],
    totalLatencyMs: 123.45,
  };

  await recordChatbotTelemetry(telemetry, database);

  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /INSERT INTO chatbot_request_logs/);
  assert.equal(calls[0][1].length, 12);
  assert.equal(JSON.stringify(calls).includes("question"), false);
});
