const uniqueText = values => [...new Set((values || [])
  .map(value => String(value || "").trim())
  .filter(Boolean))];

export const buildFacilityEmbeddingText = ({ name, description = "", aliases = [] }) =>
  uniqueText([name, description, ...aliases]).join(". ");

export const buildOfficialResourceEmbeddingText = ({ name, description = "", aliases = [] }) =>
  uniqueText([name, description, ...aliases]).join(". ");

export const createEvidenceEmbedding = async (evidence, dependencies = {}) => {
  const embed = dependencies.embedding || (await import("./embedding.services.js")).generateDocumentEmbedding;
  const text = evidence.type === "facility"
    ? buildFacilityEmbeddingText(evidence)
    : buildOfficialResourceEmbeddingText(evidence);
  if (!text) throw new Error("Evidence embedding text is required");
  return embed(text);
};
