import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOfficialResourceCatalog,
  getOfficialResourceCatalog,
  isResourceNavigationRequest,
  matchOfficialResource,
  officialResourceResponse,
} from "../src/services/official-resource.services.js";

const resources = buildOfficialResourceCatalog([
  {
    id: 3, slug: "financial-aid", name: "ULM Financial Aid", description: "Aid resources",
    url: "https://www.ulm.edu/financialaid/", response_text: "Use the official aid page.",
    priority: 80, normalized_alias: "financial aid", last_verified_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: 3, slug: "financial-aid", name: "ULM Financial Aid", description: "Aid resources",
    url: "https://www.ulm.edu/financialaid/", response_text: "Use the official aid page.",
    priority: 80, normalized_alias: "fafsa", last_verified_at: "2026-10-01T00:00:00.000Z",
  },
]);

test("groups official-resource aliases and matches whole phrases", () => {
  assert.deepEqual(resources[0].aliases, ["financial aid", "fafsa"]);
  assert.equal(matchOfficialResource("Where is the FAFSA page?", resources)?.slug, "financial-aid");
  assert.equal(matchOfficialResource("This word hasfafsaembedded", resources), null);
});

test("recognizes navigation wording without treating every factual question as navigation", () => {
  assert.equal(isResourceNavigationRequest("Where can I find the financial aid website?"), true);
  assert.equal(isResourceNavigationRequest("When is the financial aid deadline?"), false);
});

test("returns backend-owned structured source metadata", () => {
  assert.equal(officialResourceResponse(resources[0]).sources[0].url, "https://www.ulm.edu/financialaid/");
});

test("treats a missing resource table as a pending migration", async () => {
  const result = await getOfficialResourceCatalog({
    query: async () => { const error = new Error("missing"); error.code = "42P01"; throw error; },
  });
  assert.deepEqual(result, []);
});

test("routes natural campus-job wording to the validated career resource", () => {
  const [career] = buildOfficialResourceCatalog([
    {
      id: 12, slug: "career-development", name: "ULM Career Development and Handshake",
      description: "Jobs, internships, Handshake, and campus employment guidance",
      url: "https://www.ulm.edu/careerdevelopment/careerservices/handshake.html",
      response_text: "Use ULM Handshake to search for jobs.", priority: 95,
      normalized_alias: "on campus jobs",
    },
    {
      id: 12, slug: "career-development", name: "ULM Career Development and Handshake",
      description: "Jobs, internships, Handshake, and campus employment guidance",
      url: "https://www.ulm.edu/careerdevelopment/careerservices/handshake.html",
      response_text: "Use ULM Handshake to search for jobs.", priority: 95,
      normalized_alias: "campus jobs",
    },
  ]);

  assert.equal(
    matchOfficialResource("How do I find on campus jobs?", [career])?.slug,
    "career-development",
  );
  assert.equal(isResourceNavigationRequest("How do I find on campus jobs?"), true);
});
