import test from "node:test";
import assert from "node:assert/strict";
import { SCHULZE_MENU_URL, tryHandleDiningMenuLink } from "../src/services/dining-menu-link.services.js";

test("routes Schulze menu questions to the official dining page", () => {
  for (const question of [
    "What are they serving at Schulze right now?",
    "What's for lunch at the dining hall?",
    "Can I see the cafeteria menu?",
    "What food do they have at the caf?",
  ]) {
    const result = tryHandleDiningMenuLink(question);
    assert.equal(result?.sourceType, "dining_link");
    assert.equal(result?.matched, true);
    assert.match(result?.response, new RegExp(SCHULZE_MENU_URL));
  }
});

test("leaves dining hours and unrelated food questions to existing routing", () => {
  for (const question of [
    "When does Schulze close?",
    "Is the dining hall open?",
    "Where is the cafeteria?",
    "Where can I eat on campus?",
  ]) {
    assert.equal(tryHandleDiningMenuLink(question), null);
  }
});
