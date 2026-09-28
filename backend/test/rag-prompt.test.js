import test from "node:test";
import assert from "node:assert/strict";
import { RAG_FRESHNESS_INSTRUCTION } from "../src/services/rag-prompt.services.js";

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
