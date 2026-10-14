import test from "node:test";
import assert from "node:assert/strict";
import {
  FACILITY_LIMIT,
  OFFICIAL_RESOURCE_LIMIT,
  retrieveFacilityCandidates,
  retrieveOfficialResourceCandidates,
  retrieveUnifiedEvidence,
} from "../src/services/unified-retrieval.services.js";

test("official-resource retrieval is hybrid, bounded, and returns the orchestration shape", async () => {
  let captured;
  const rows = [{
    id: "12",
    slug: "career-development",
    name: "ULM Career Development and Handshake",
    description: "Jobs and internships",
    url: "https://www.ulm.edu/careerdevelopment/",
    response_text: "Use Handshake.",
    requires_login: true,
    last_verified_at: "2026-10-01T00:00:00.000Z",
    similarity: "0.81",
  }];

  const result = await retrieveOfficialResourceCandidates([0.1, 0.2], "on-campus jobs", {
    database: { query: async (text, values) => { captured = { text, values }; return { rows }; } },
  });

  assert.equal(OFFICIAL_RESOURCE_LIMIT, 3);
  assert.deepEqual(captured.values, [JSON.stringify([0.1, 0.2]), "on campus jobs", 3]);
  assert.match(captured.text, /official_resources/);
  assert.match(captured.text, /official_resource_aliases/);
  assert.match(captured.text, /unnest\(alias_list\)/);
  assert.match(captured.text, /regexp_replace\(r\.name, '\^ULM/);
  assert.match(captured.text, /WHERE alias_match OR acronym_match OR similarity >= 0\.35 OR text_score > 0/);
  assert.match(captured.text, /embedding <=> \$1::vector/);
  assert.match(captured.text, /websearch_to_tsquery\('english', \$2\)/);
  assert.match(captured.text, /to_tsvector\('english', name \|\| ' ' \|\| description \|\| ' ' \|\| aliases\)/);
  assert.match(captured.text, /LIMIT \$3/);
  assert.deepEqual(result, [{
    resourceId: 12,
    slug: "career-development",
    name: "ULM Career Development and Handshake",
    description: "Jobs and internships",
    url: "https://www.ulm.edu/careerdevelopment/",
    responseText: "Use Handshake.",
    requiresLogin: true,
    lastVerifiedAt: "2026-10-01T00:00:00.000Z",
    similarity: 0.81,
  }]);
});

test("official-resource retrieval does not interpret name hyphens as exclusions", async () => {
  let params;
  await retrieveOfficialResourceCandidates([0.1], "Fant-Ewing information", {
    database: { query: async (_sql, values) => { params = values; return { rows: [] }; } },
  });
  assert.equal(params[1], "Fant Ewing information");
});

test("facility retrieval is hybrid, bounded, and does not expose aliases", async () => {
  let captured;
  const result = await retrieveFacilityCandidates([0.4], "place where I work out", {
    database: {
      query: async (text, values) => {
        captured = { text, values };
        return { rows: [{ id: 3, name: "Activity Center", description: "Campus recreation and fitness", similarity: 0.72 }] };
      },
    },
  });

  assert.equal(FACILITY_LIMIT, 3);
  assert.deepEqual(captured.values, [JSON.stringify([0.4]), "place where I work out", 3]);
  assert.match(captured.text, /FROM facilities/);
  assert.match(captured.text, /facility_aliases/);
  assert.match(captured.text, /embedding <=> \$1::vector/);
  assert.match(captured.text, /websearch_to_tsquery\('english', \$2\)/);
  assert.deepEqual(result, [{
    facilityId: 3,
    facilityName: "Activity Center",
    description: "Campus recreation and fitness",
    similarity: 0.72,
  }]);
  assert.equal("aliases" in result[0], false);
});

test("unified retrieval starts all branches together and returns typed candidate pools", async () => {
  const started = [];
  const releases = [];
  const database = {
    query: async text => {
      const branch = text.includes("official_resources")
        ? "official"
        : text.includes("FROM facilities")
          ? "facility"
          : "knowledge";
      started.push(branch);
      await new Promise(resolve => releases.push(resolve));
      if (branch === "official") return { rows: [{ id: 8, name: "Registrar", description: "Registration", url: "https://ulm.edu/registrar", similarity: 0.8 }] };
      if (branch === "facility") return { rows: [{ id: 4, name: "Library", description: "University library", similarity: 0.7 }] };
      return { rows: [{ id: 2, cleaned_content: "Registration uses Banner.", similarity: 0.9 }] };
    },
  };

  const pending = retrieveUnifiedEvidence([0.2], "registration", { database });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(new Set(started), new Set(["knowledge", "official", "facility"]));
  releases.forEach(resolve => resolve());

  const result = await pending;
  assert.equal(result.knowledge[0].id, 2);
  assert.equal(result.officialResources[0].resourceId, 8);
  assert.equal(result.facilities[0].facilityId, 4);
});

test("missing optional embedding columns degrade to empty branches without losing knowledge", async () => {
  const database = {
    query: async text => {
      if (text.includes("official_resources") || text.includes("FROM facilities")) {
        const error = new Error("column embedding does not exist");
        error.code = "42703";
        throw error;
      }
      return { rows: [{ id: 5, cleaned_content: "Verified knowledge", similarity: 0.88 }] };
    },
  };

  const result = await retrieveUnifiedEvidence([0.3], "verified", { database });

  assert.equal(result.knowledge.length, 1);
  assert.deepEqual(result.officialResources, []);
  assert.deepEqual(result.facilities, []);
});

test("a missing primary knowledge table is surfaced instead of disguised as a miss", async () => {
  const database = {
    query: async () => {
      const error = new Error("relation does not exist");
      error.code = "42P01";
      throw error;
    },
  };

  await assert.rejects(
    () => retrieveUnifiedEvidence([0.3], "anything", { database }),
    error => error.code === "42P01",
  );
});
