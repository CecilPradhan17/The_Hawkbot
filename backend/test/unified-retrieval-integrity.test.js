import test from "node:test";
import assert from "node:assert/strict";
import { retrieveUnifiedEvidence } from "../src/services/unified-retrieval.services.js";

const branchFor = text => text.includes("official_resources")
  ? "official"
  : text.includes("FROM facilities")
    ? "facility"
    : "knowledge";

test("propagates a primary approved-knowledge retrieval failure", async () => {
  const primaryError = new Error("approved knowledge query failed");
  primaryError.code = "XX000";
  const started = [];
  const database = {
    query: async text => {
      const branch = branchFor(text);
      started.push(branch);
      if (branch === "knowledge") throw primaryError;
      return { rows: [] };
    },
  };

  await assert.rejects(
    retrieveUnifiedEvidence([0.2], "campus question", { database }),
    error => error === primaryError,
  );
  assert.deepEqual(new Set(started), new Set(["knowledge", "official", "facility"]));
});

test("optional resource and facility failures degrade independently to empty pools", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const database = {
      query: async text => {
        const branch = branchFor(text);
        if (branch === "official") throw new Error("official lookup unavailable");
        if (branch === "facility") throw new Error("facility lookup unavailable");
        return { rows: [{ id: 17, cleaned_content: "Verified fact", similarity: 0.91 }] };
      },
    };

    const result = await retrieveUnifiedEvidence([0.2], "verified fact", { database });

    assert.deepEqual(result.knowledge, [{ id: 17, cleaned_content: "Verified fact", similarity: 0.91 }]);
    assert.deepEqual(result.officialResources, []);
    assert.deepEqual(result.facilities, []);
  } finally {
    console.error = originalError;
  }
});

test("one optional failure does not discard a successful optional evidence branch", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const database = {
      query: async text => {
        const branch = branchFor(text);
        if (branch === "official") throw new Error("resource lookup unavailable");
        if (branch === "facility") {
          return { rows: [{ id: 4, name: "Library", description: "University library", similarity: 0.78 }] };
        }
        return { rows: [] };
      },
    };

    const result = await retrieveUnifiedEvidence([0.2], "library", { database });

    assert.deepEqual(result.officialResources, []);
    assert.deepEqual(result.facilities, [{
      facilityId: 4,
      facilityName: "Library",
      description: "University library",
      similarity: 0.78,
    }]);
  } finally {
    console.error = originalError;
  }
});
