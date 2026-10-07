import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../migrations/023_add_knowledge_admin_actions.sql", import.meta.url),
  "utf8",
);

test("adds an archived knowledge status without changing active retrieval semantics", () => {
  assert.match(migration, /'active', 'needs_update', 'replaced', 'archived'/);
});

test("allows an admin action to cancel an open verification", () => {
  assert.match(migration, /'open', 'reconfirmed', 'rejected', 'unresolved', 'exhausted', 'cancelled'/);
});

test("records auditable correction and archive actions", () => {
  assert.match(migration, /CREATE TABLE knowledge_admin_actions/);
  assert.match(migration, /knowledge_id INTEGER NOT NULL REFERENCES approved_knowledge/);
  assert.match(migration, /replacement_knowledge_id INTEGER REFERENCES approved_knowledge/);
  assert.match(migration, /admin_user_id INTEGER REFERENCES users/);
  assert.match(migration, /action IN \('corrected', 'archived'\)/);
  assert.match(migration, /char_length\(note\) <= 1000/);
  assert.match(migration, /action = 'corrected' AND replacement_knowledge_id IS NOT NULL/);
  assert.match(migration, /action = 'archived' AND replacement_knowledge_id IS NULL/);
});

test("prevents deleting facts that are part of the admin audit trail", () => {
  assert.match(migration, /approved_knowledge\(id\) ON DELETE RESTRICT/);
});
