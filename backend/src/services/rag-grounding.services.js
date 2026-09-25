export const normalizeGroundedResponse = (result, allowedCandidateIds = []) => {
  const allowed = new Set(allowedCandidateIds.map(Number));
  const submitted = Array.isArray(result?.relevantCandidateIds)
    ? [...new Set(result.relevantCandidateIds.map(Number))]
    : [];
  const selectionsAreValid = submitted.length > 0
    && submitted.every(id => Number.isInteger(id) && allowed.has(id));
  const response = typeof result?.response === "string" ? result.response.trim() : "";
  const answerable = result?.answerable === true && response.length > 0 && selectionsAreValid;
  return {
    answerable,
    response: answerable ? response : "",
    relevantCandidateIds: answerable ? submitted : [],
  };
};
