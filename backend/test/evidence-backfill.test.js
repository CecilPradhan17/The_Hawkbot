import test from "node:test";
import assert from "node:assert/strict";
import { backfillMissingEvidenceEmbeddings } from "../src/services/evidence-backfill.services.js";

const makeDatabase = ({ missingAfter = false } = {}) => {
  const updates = [];
  const database = {
    updates,
    async query(sql, params = []) {
      if (sql.includes("FROM approved_knowledge") && sql.includes("ORDER BY id")) {
        return { rowCount: 1, rows: [{ id: 7, cleaned_content: "Verified campus fact", raw_content: "raw" }] };
      }
      if (sql.includes("FROM official_resources r")) {
        return { rowCount: 1, rows: [{ id: 8, name: "Registrar", description: "Records", aliases: ["transcripts"] }] };
      }
      if (sql.includes("FROM facilities f")) {
        return { rowCount: 1, rows: [{ id: 9, name: "Library", description: "Study space", aliases: ["ulm library"] }] };
      }
      if (sql.trim().startsWith("UPDATE")) {
        updates.push({ sql: sql.trim(), params });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("knowledge_missing")) {
        return { rows: [{
          knowledge_missing: missingAfter ? 1 : 0,
          resources_missing: 0,
          facilities_missing: 0,
        }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return database;
};

test("backfills active knowledge as well as optional evidence catalogs", async () => {
  const database = makeDatabase();
  const embedded = [];
  const counts = await backfillMissingEvidenceEmbeddings({
    database,
    embedding: async text => { embedded.push(text); return [0.1, 0.2]; },
  });

  assert.deepEqual(counts, { knowledge: 1, officialResources: 1, facilities: 1 });
  assert.deepEqual(embedded, [
    "Verified campus fact",
    "Registrar. Records. transcripts",
    "Library. Study space. ulm library",
  ]);
  assert.match(database.updates[0].sql, /^UPDATE approved_knowledge/);
  assert.deepEqual(database.updates[0].params, ["[0.1,0.2]", 7]);
});

test("fails the backfill when active knowledge remains without an embedding", async () => {
  await assert.rejects(
    () => backfillMissingEvidenceEmbeddings({
      database: makeDatabase({ missingAfter: true }),
      embedding: async () => [0.1],
    }),
    /integrity check failed.*knowledge_missing.*1/,
  );
});
