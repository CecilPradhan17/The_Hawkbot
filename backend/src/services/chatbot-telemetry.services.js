import { randomUUID } from "node:crypto";
import pool from "../db.js";

const MODEL_PRICING_PER_MILLION = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-5.5": { input: 5.00, output: 30.00 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

const WEB_SEARCH_COST_PER_CALL = 0.01;
export const CHATBOT_PRICING_VERSION = "2026-10-16";

const pricingForModel = model => {
  if (MODEL_PRICING_PER_MILLION[model]) return MODEL_PRICING_PER_MILLION[model];
  return Object.entries(MODEL_PRICING_PER_MILLION)
    .find(([name]) => String(model || "").startsWith(`${name}-`))?.[1];
};

export const classifyChatQuery = question => {
  const text = String(question || "").toLowerCase();
  if (/\b(?:final exams?|academic calendar|registration|add\s*\/\s*drop|drop(?:ping)?\s+(?:a\s+)?class|withdraw(?:al|ing)?|semester|commencement|graduation date)\b/.test(text)) return "academic_calendar";
  if (/\b(?:hours?|open|close[sd]?|closing|opening)\b/.test(text)) return "facility_hours";
  if (/\b(?:menu|dining|schulze|cafeteria|what.*serving)\b/.test(text)) return "dining";
  if (/\b(?:news|announcement|event|symposium|career fair|workshop|upcoming)\b/.test(text)) return "news_events";
  if (/\b(?:professor|faculty|staff|email|phone|office|contact)\b/.test(text)) return "personnel_contact";
  if (/\b(?:football|basketball|baseball|softball|volleyball|game|warhawks?|athletics?)\b/.test(text)) return "athletics";
  if (/^\s*(?:hi|hello|hey|thanks|thank you|bye)[!.?\s]*$/i.test(text)) return "smalltalk";
  return "campus_information";
};

export const calculateChatbotCost = ({ tokenUsage = [], webSearchCalls = 0 }) => {
  const breakdown = tokenUsage.map(item => {
    const pricing = pricingForModel(item.model);
    const inputTokens = Number(item.inputTokens) || 0;
    const outputTokens = Number(item.outputTokens) || 0;
    const estimatedCostUsd = pricing
      ? (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
      : 0;
    return { ...item, estimatedCostUsd };
  });
  if (webSearchCalls > 0) {
    breakdown.push({
      stage: "web_search_tool_calls",
      calls: webSearchCalls,
      estimatedCostUsd: webSearchCalls * WEB_SEARCH_COST_PER_CALL,
    });
  }
  return {
    estimatedCostUsd: breakdown.reduce((total, item) => total + item.estimatedCostUsd, 0),
    breakdown,
  };
};

export const buildChatbotTelemetry = ({ question, event }) => {
  const webSearchCalls = event.toolExecutions
    .reduce((total, tool) => total + (Number(tool.webSearchCalls) || 0), 0);
  const cost = calculateChatbotCost({ tokenUsage: event.tokenUsage, webSearchCalls });
  return {
    requestId: randomUUID(),
    queryCategory: classifyChatQuery(question),
    route: event.route,
    outcome: event.outcome,
    deterministicMatcher: event.deterministicMatcher,
    tools: event.toolExecutions,
    tokenUsage: event.tokenUsage,
    webSearchCalls,
    estimatedCostUsd: cost.estimatedCostUsd,
    pricingVersion: CHATBOT_PRICING_VERSION,
    costBreakdown: cost.breakdown,
    totalLatencyMs: event.latencyMs.total,
  };
};

export const recordChatbotTelemetry = async (telemetry, database = pool) => {
  await database.query(
    `INSERT INTO chatbot_request_logs (
       request_id, query_category, route, outcome, deterministic_matcher,
       tools, token_usage, web_search_calls, estimated_cost_usd,
       pricing_version, cost_breakdown, total_latency_ms
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb, $12)`,
    [
      telemetry.requestId,
      telemetry.queryCategory,
      telemetry.route,
      telemetry.outcome,
      telemetry.deterministicMatcher,
      JSON.stringify(telemetry.tools),
      JSON.stringify(telemetry.tokenUsage),
      telemetry.webSearchCalls,
      telemetry.estimatedCostUsd,
      telemetry.pricingVersion,
      JSON.stringify(telemetry.costBreakdown),
      telemetry.totalLatencyMs,
    ],
  );
};
