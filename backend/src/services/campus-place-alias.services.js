import { getFacilityDictionary } from "./hours-repository.services.js";
import { normalizeAlias } from "./hours-publication.services.js";

const MAX_CANONICAL_ADDITIONS = 5;

const containsPhrase = (normalizedQuery, normalizedPhrase) =>
  ` ${normalizedQuery} `.includes(` ${normalizedPhrase} `);

export const resolveUniqueCampusFacility = async (query, dependencies = {}) => {
  const dictionary = dependencies.dictionary
    || (() => getFacilityDictionary(dependencies.database));
  const normalizedQuery = normalizeAlias(query);
  if (!normalizedQuery) return null;

  const matches = new Map();
  for (const entry of await dictionary()) {
    const alias = normalizeAlias(entry.normalized_alias);
    if (alias && containsPhrase(normalizedQuery, alias)) {
      matches.set(Number(entry.id), { id: Number(entry.id), name: entry.name });
    }
  }

  return matches.size === 1 ? [...matches.values()][0] : null;
};

export const resolveCampusPlaceRelationships = async (query, dependencies = {}) => {
  const dictionary = dependencies.dictionary
    || (() => getFacilityDictionary(dependencies.database));
  const normalizedQuery = normalizeAlias(query);
  if (!normalizedQuery) return [];

  const aliases = new Map();
  for (const entry of await dictionary()) {
    const alias = normalizeAlias(entry.normalized_alias);
    if (!alias) continue;
    const facilities = aliases.get(alias) || new Map();
    facilities.set(Number(entry.id), entry.name);
    aliases.set(alias, facilities);
  }

  return [...aliases.entries()]
    .filter(([alias, facilities]) => containsPhrase(normalizedQuery, alias) && facilities.size === 1)
    .sort(([left], [right]) => right.length - left.length)
    .slice(0, MAX_CANONICAL_ADDITIONS)
    .map(([alias, facilities]) => {
      const [facilityId, facilityName] = [...facilities.entries()][0];
      return {
        relationshipId: `facility-alias:${facilityId}:${alias}`,
        type: "campus_place_alias",
        alias,
        facilityId,
        facilityName,
        statement: `The campus term "${alias}" refers to ${facilityName}.`,
      };
    });
};

export const expandCampusPlaceAliases = async (query, dependencies = {}) => {
  const dictionary = dependencies.dictionary
    || (() => getFacilityDictionary(dependencies.database));
  const normalizedQuery = normalizeAlias(query);
  if (!normalizedQuery) return String(query || "");

  const aliases = new Map();
  for (const entry of await dictionary()) {
    const normalizedAlias = normalizeAlias(entry.normalized_alias);
    if (!normalizedAlias) continue;
    const matches = aliases.get(normalizedAlias) || new Map();
    matches.set(Number(entry.id), entry.name);
    aliases.set(normalizedAlias, matches);
  }

  const additions = new Map();
  const orderedAliases = [...aliases.entries()]
    .sort(([left], [right]) => right.length - left.length);

  for (const [alias, facilities] of orderedAliases) {
    if (!containsPhrase(normalizedQuery, alias) || facilities.size !== 1) continue;
    const [facilityId, canonicalName] = [...facilities.entries()][0];
    const normalizedCanonical = normalizeAlias(canonicalName);
    if (containsPhrase(normalizedQuery, normalizedCanonical)) continue;
    additions.set(facilityId, canonicalName);
    if (additions.size >= MAX_CANONICAL_ADDITIONS) break;
  }

  return additions.size > 0
    ? `${query} ${[...additions.values()].join(" ")}`
    : String(query || "");
};
