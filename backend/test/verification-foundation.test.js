import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../migrations/018_add_knowledge_verifications.sql", import.meta.url),
  "utf8",
);

test("creates one non-login Hawkbot system identity", () => {
  assert.match(migration, /ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /WHERE is_system = TRUE/);
  assert.match(migration, /hawkbot-system@internal\.invalid/);
  assert.match(migration, /'Hawkbot'/);
});

test("adds a dedicated verification post type", () => {
  assert.match(migration, /'post', 'question', 'answer', 'verification'/);
});

test("tracks two one-week verification attempts without duplicate open reviews", () => {
  assert.match(migration, /CREATE TABLE knowledge_verifications/);
  assert.match(migration, /attempt_number IN \(1, 2\)/);
  assert.match(migration, /'open', 'reconfirmed', 'rejected', 'unresolved', 'exhausted'/);
  assert.match(migration, /UNIQUE \(knowledge_id, cycle_started_at, attempt_number\)/);
  assert.match(migration, /knowledge_verifications_one_open_per_fact_idx/);
  assert.match(migration, /WHERE status = 'open'/);
  assert.match(migration, /closes_at > opened_at/);
});

test("login query excludes system identities while remaining pre-migration compatible", () => {
  const loginService = readFileSync(
    new URL("../src/services/login.services.js", import.meta.url),
    "utf8",
  );
  assert.match(loginService, /to_jsonb\(u\)->>'is_system'/);
  assert.match(loginService, /= FALSE/);
});
