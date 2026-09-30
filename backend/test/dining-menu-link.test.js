import test from "node:test";
import assert from "node:assert/strict";
import { SCHULZE_MENU_URL, tryHandleDiningMenuLink } from "../src/services/dining-menu-link.services.js";

const dictionary = async () => [
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "schulze dining hall" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "schulze" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "dining" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "dining hall" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "cafeteria" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "caf" },
];

test("routes Schulze menu questions to the official dining page", async () => {
  for (const question of [
    "What are they serving at Schulze right now?",
    "whats at the dining right now",
    "What's for lunch at the dining hall?",
    "Can I see the cafeteria menu?",
    "What food do they have at the caf?",
  ]) {
    const result = await tryHandleDiningMenuLink(question, { dictionary });
    assert.equal(result?.sourceType, "dining_link");
    assert.equal(result?.matched, true);
    assert.match(result?.response, new RegExp(SCHULZE_MENU_URL));
  }
});

test("leaves dining hours and unrelated food questions to existing routing", async () => {
  for (const question of [
    "When does Schulze close?",
    "Is the dining hall open?",
    "Where is the cafeteria?",
    "Where can I eat on campus?",
  ]) {
    assert.equal(await tryHandleDiningMenuLink(question, { dictionary }), null);
  }
});

test("uses configured aliases rather than built-in dining nicknames", async () => {
  const customDictionary = async () => [
    { id: 2, name: "Schulze Dining Hall", normalized_alias: "warhawk food place" },
  ];
  const result = await tryHandleDiningMenuLink("whats at the warhawk food place", {
    dictionary: customDictionary,
  });
  assert.equal(result?.sourceType, "dining_link");
});
