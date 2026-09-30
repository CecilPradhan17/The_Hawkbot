import { normalizeAlias } from "./hours-publication.services.js";
import { resolveUniqueCampusFacility } from "./campus-place-alias.services.js";

export const SCHULZE_MENU_URL = "https://ulm.mydininghub.com/en/location/schulze";

export const diningMenuLinkResponse = () => ({
  response: `You can view the current Schulze Dining Hall menu on ULM Dining's official website.\n\nSource: ${SCHULZE_MENU_URL}`,
  matched: true,
  sourceType: "dining_link",
});

const normalize = message => message
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9'\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export async function tryHandleDiningMenuLink(message, dependencies = {}) {
  if (typeof message !== "string") return null;
  const normalized = normalize(message);
  const asksForMenu = /\bmenu\b|\bserv(?:e|es|ed|ing)\b|\b(?:what's|whats|what is) (?:at|for)\b|\bwhat (?:food|foods|dishes)\b|\bwhat do they have\b/.test(normalized);
  if (!asksForMenu) return null;

  const facility = await resolveUniqueCampusFacility(message, dependencies);
  const canonicalName = normalizeAlias(facility?.name);
  if (!facility || !/\b(?:schulze|dining)\b/.test(canonicalName)) return null;

  return diningMenuLinkResponse();
}
