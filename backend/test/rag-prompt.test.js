import test from "node:test";
import assert from "node:assert/strict";
import { RAG_FRESHNESS_INSTRUCTION, RAG_SCOPE_INSTRUCTION } from "../src/services/rag-prompt.services.js";

test("freshness resolves conflicts without replacing relevance", () => {
  assert.match(RAG_FRESHNESS_INSTRUCTION, /Freshness never overrides relevance/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /claims are compatible/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /mutually incompatible claims/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /newest lastVerifiedAt/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /newest approvedAt/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /remain equally current/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /answerable to false/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /rather than guessing/i);
  assert.match(RAG_FRESHNESS_INSTRUCTION, /Never combine mutually incompatible claims/i);
});

test("broad campus-service questions allow qualified examples without implying completeness", () => {
  assert.match(RAG_SCOPE_INSTRUCTION, /useful non-exhaustive answer/i);
  assert.match(RAG_SCOPE_INSTRUCTION, /One service the center offers is/i);
  assert.match(RAG_SCOPE_INSTRUCTION, /Never describe a partial example as a complete list/i);
  assert.match(RAG_SCOPE_INSTRUCTION, /never invent additional services/i);
});
