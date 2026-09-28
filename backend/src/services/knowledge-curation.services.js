const MAX_KNOWLEDGE_CHUNKS = 12;
export const REVIEW_CATEGORIES = new Set(["stable", "yearly", "term", "frequent"]);
export const DEFAULT_REVIEW_CATEGORY = "frequent";

export const normalizeKnowledgeChunks = (value) => {
  const chunks = Array.isArray(value) ? value : value?.chunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set();

  return chunks
    .map((chunk) => ({
      content: typeof chunk?.fact === "string" ? chunk.fact.trim() : "",
      reviewCategory: REVIEW_CATEGORIES.has(chunk?.reviewCategory)
        ? chunk.reviewCategory
        : DEFAULT_REVIEW_CATEGORY,
    }))
    .filter((chunk) => chunk.content)
    .filter((chunk) => {
      const key = chunk.content.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_KNOWLEDGE_CHUNKS);
};
