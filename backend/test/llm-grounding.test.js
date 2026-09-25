import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGroundedResponse } from "../src/services/rag-grounding.services.js";

test("accepts a grounded answer selecting only retrieved candidate IDs", () => {
  assert.deepEqual(normalizeGroundedResponse({
    answerable: true,
    response: "  Supported answer.  ",
    relevantCandidateIds: [4, 4, 7],
  }, [4, 7, 9]), {
    answerable: true,
    response: "Supported answer.",
    relevantCandidateIds: [4, 7],
  });
});

test("rejects missing, empty, or invented candidate selections", () => {
  for (const result of [
    { answerable: true, response: "Answer", relevantCandidateIds: [] },
    { answerable: true, response: "Answer", relevantCandidateIds: [999] },
    { answerable: true, response: "", relevantCandidateIds: [4] },
  ]) {
    assert.deepEqual(normalizeGroundedResponse(result, [4, 7]), {
      answerable: false,
      response: "",
      relevantCandidateIds: [],
    });
  }
});
