import pool from "../db.js";
import { createEvidenceEmbedding } from "./evidence-embedding.services.js";

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
  // Only bypass RAG when the requested answer is itself a digital/contact resource.
  // Broad wording such as "where can I get an ID" or "how do I find a job" asks
  // for instructions, not merely a link, and must retain the grounded RAG answer.
  return /\b(?:website|webpage|site|link|portal|page|email|phone|map|directory)\b/.test(text)
    || /\bcontact (?:information|info|details|page)\b/.test(text);
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

/**
 * Shared write boundary for future resource administration/imports. Keeping
 * embedding generation here prevents resource metadata and retrieval vectors
 * from drifting apart.
 */
export async function upsertOfficialResource(input, database = pool, dependencies = {}) {
  const slug = normalize(input?.slug).replace(/\s+/g, "-");
  const name = String(input?.name || "").trim();
  const description = String(input?.description || "").trim();
  const url = String(input?.url || "").trim();
  const responseText = String(input?.responseText || "").trim();
  const aliases = [...new Set((input?.aliases || []).map(normalize).filter(Boolean))];
  if (!slug || !name || !description || !responseText || !/^https:\/\//i.test(url)) {
    const error = new Error("Valid resource slug, name, description, HTTPS URL, and response text are required");
    error.status = 400;
    throw error;
  }
  const embedding = await createEvidenceEmbedding({
    type: "official_resource", name, description, aliases,
  }, dependencies);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO official_resources
        (slug, name, description, url, response_text, requires_login, priority, active, embedding, last_verified_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8::vector, NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description, url = EXCLUDED.url,
         response_text = EXCLUDED.response_text, requires_login = EXCLUDED.requires_login,
         priority = EXCLUDED.priority, active = TRUE, embedding = EXCLUDED.embedding,
         last_verified_at = NOW(), updated_at = NOW()
       RETURNING id`,
      [slug, name, description, url, responseText, Boolean(input.requiresLogin), Number(input.priority) || 0, JSON.stringify(embedding)],
    );
    const resourceId = Number(result.rows[0].id);
    await client.query("DELETE FROM official_resource_aliases WHERE resource_id = $1", [resourceId]);
    for (const alias of aliases) {
      await client.query(
        "INSERT INTO official_resource_aliases (resource_id, normalized_alias) VALUES ($1, $2)",
        [resourceId, alias],
      );
    }
    await client.query("COMMIT");
    return { resourceId, slug, name, description, url, aliases };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
