import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFacilityEmbeddingText,
  buildOfficialResourceEmbeddingText,
} from "../src/services/evidence-embedding.services.js";
import { upsertOfficialResource } from "../src/services/official-resource.services.js";

test("builds stable embedding text without duplicate labels", () => {
  assert.equal(buildFacilityEmbeddingText({
    name: "Activity Center", aliases: ["AC", "Activity Center", "gym"],
  }), "Activity Center. AC. gym");
  assert.equal(buildOfficialResourceEmbeddingText({
    name: "Career Center", description: "Student employment", aliases: ["campus jobs"],
  }), "Career Center. Student employment. campus jobs");
});

test("official resource writes update metadata, aliases, and embedding atomically", async () => {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.includes("RETURNING id")) return { rows: [{ id: 12 }] };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  let embeddedText;
  const result = await upsertOfficialResource({
    slug: "Career Center", name: "ULM Career Center", description: "Student employment",
    url: "https://www.ulm.edu/career/", responseText: "Visit the Career Center.",
    aliases: ["Campus Jobs", "campus jobs", "on-campus work"], priority: 80,
  }, { connect: async () => client }, {
    embedding: async text => { embeddedText = text; return [0.4, 0.5]; },
  });

  assert.equal(embeddedText, "ULM Career Center. Student employment. campus jobs. on campus work");
  assert.equal(result.resourceId, 12);
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls[1].params.at(-1), "[0.4,0.5]");
  assert.equal(calls.filter(call => call.sql.startsWith("INSERT INTO official_resource_aliases")).length, 2);
  assert.equal(calls.at(-1).sql, "COMMIT");
});
