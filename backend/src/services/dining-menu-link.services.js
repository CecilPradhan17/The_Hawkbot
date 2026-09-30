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

export function tryHandleDiningMenuLink(message) {
  if (typeof message !== "string") return null;
  const normalized = normalize(message);
  const namesDiningLocation = /\b(?:schulze|dining hall|cafeteria|the caf|ulm dining)\b/.test(normalized);
  const asksForMenu = /\bmenu\b|\bserv(?:e|es|ed|ing)\b|\bwhat(?:'s| is) for (?:breakfast|brunch|lunch|dinner)\b|\bwhat (?:food|foods|dishes)\b|\bwhat do they have\b/.test(normalized);

  if (!namesDiningLocation || !asksForMenu) return null;

  return diningMenuLinkResponse();
}
