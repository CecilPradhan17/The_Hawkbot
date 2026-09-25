const MAX_KNOWLEDGE_CHUNKS = 12;

export const normalizeKnowledgeChunks = (value) => {
  const chunks = Array.isArray(value) ? value : value?.chunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set();

  return chunks
    .map((chunk) => typeof chunk?.fact === "string" ? chunk.fact.trim() : "")
    .filter(Boolean)
    .filter((fact) => {
      const key = fact.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_KNOWLEDGE_CHUNKS);
};
