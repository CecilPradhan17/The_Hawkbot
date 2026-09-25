const candidateText = candidate =>
  `${candidate?.cleaned_content || ""} ${candidate?.raw_content || ""}`.toLowerCase();

export const findRelevantRank = (evaluationCase, candidates) => {
  const expected = Array.isArray(evaluationCase?.expectedAny)
    ? evaluationCase.expectedAny.map(value => String(value).toLowerCase()).filter(Boolean)
    : [];
  if (expected.length === 0) return 0;
  const index = candidates.findIndex(candidate => {
    const text = candidateText(candidate);
    return expected.some(phrase => text.includes(phrase));
  });
  return index < 0 ? 0 : index + 1;
};

export const summarizeRetrievalEvaluation = results => {
  if (!Array.isArray(results) || results.length === 0) {
    return { total: 0, top1: 0, top3: 0, top10: 0, mrr: 0, failures: [] };
  }
  const at = limit => results.filter(result => result.rank > 0 && result.rank <= limit).length / results.length;
  return {
    total: results.length,
    top1: at(1),
    top3: at(3),
    top10: at(10),
    mrr: results.reduce((sum, result) => sum + (result.rank > 0 ? 1 / result.rank : 0), 0) / results.length,
    failures: results.filter(result => result.rank === 0),
  };
};
