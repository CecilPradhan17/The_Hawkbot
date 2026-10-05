import pool from "../db.js";

const normalize = value => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[’']/g, "'")
  .replace(/\b([a-z0-9]+)'s\b/g, "$1")
  .replace(/[^a-z0-9'\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const hasPhrase = (message, phrase) => ` ${message} `.includes(` ${phrase} `);

export const isResourceNavigationRequest = message => {
  const text = normalize(message);
  return /\b(?:where|find|access|website|webpage|site|link|portal|page|contact|email|phone|map|directory)\b/.test(text)
    || /\bhow (?:do|can) i\b/.test(text);
};

export const buildOfficialResourceCatalog = rows => {
  const resources = new Map();
  for (const row of rows || []) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || !row.slug || !row.name || !row.url) continue;
    const current = resources.get(id) || {
      resourceId: id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      url: row.url,
      responseText: row.response_text,
      requiresLogin: Boolean(row.requires_login),
      lastVerifiedAt: row.last_verified_at,
      priority: Number(row.priority) || 0,
      aliases: [],
    };
    if (row.normalized_alias && !current.aliases.includes(row.normalized_alias)) {
      current.aliases.push(row.normalized_alias);
    }
    resources.set(id, current);
  }
  return [...resources.values()];
};

export async function getOfficialResourceCatalog(database = pool) {
  try {
    const { rows } = await database.query(`
      SELECT resource.*, alias.normalized_alias
      FROM official_resources resource
      LEFT JOIN official_resource_aliases alias ON alias.resource_id = resource.id
      WHERE resource.active = TRUE
      ORDER BY resource.priority DESC, resource.id, alias.normalized_alias
    `);
    return buildOfficialResourceCatalog(rows);
  } catch (error) {
    // Allows the application to remain available while the manual Neon migration is pending.
    if (error?.code === "42P01") return [];
    throw error;
  }
}

export function matchOfficialResource(message, resources) {
  const text = normalize(message);
  const matches = [];
  for (const resource of resources || []) {
    const aliases = resource.aliases || [];
    const matchingAliases = aliases.filter(alias => hasPhrase(text, normalize(alias)));
    if (!matchingAliases.length) continue;
    matches.push({
      resource,
      length: Math.max(...matchingAliases.map(alias => normalize(alias).length)),
    });
  }
  matches.sort((a, b) => b.length - a.length || b.resource.priority - a.resource.priority);
  if (!matches.length) return null;
  if (matches[1] && matches[1].length === matches[0].length
    && matches[1].resource.priority === matches[0].resource.priority) return null;
  return matches[0].resource;
}

export const officialResourceResponse = resource => ({
  response: resource.responseText || `You can find that on ${resource.name}.`,
  matched: true,
  sourceType: "official_resource",
  sources: [{
    title: resource.name,
    url: resource.url,
    lastVerifiedAt: resource.lastVerifiedAt || null,
  }],
});
