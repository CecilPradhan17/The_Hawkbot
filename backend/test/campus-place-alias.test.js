import test from "node:test";
import assert from "node:assert/strict";
import { expandCampusPlaceAliases } from "../src/services/campus-place-alias.services.js";

const dictionary = async () => [
  { id: 1, name: "Activity Center", normalized_alias: "activity center" },
  { id: 1, name: "Activity Center", normalized_alias: "ac" },
  { id: 1, name: "Activity Center", normalized_alias: "gym" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "schulze dining hall" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "caf" },
  { id: 2, name: "Schulze Dining Hall", normalized_alias: "cafeteria" },
];

test("adds only the canonical place name for a matched alias", async () => {
  assert.equal(
    await expandCampusPlaceAliases("is the caf open", { dictionary }),
    "is the caf open Schulze Dining Hall",
  );
});

test("does not append sibling aliases or duplicate a canonical name", async () => {
  assert.equal(
    await expandCampusPlaceAliases("Schulze Dining Hall menu", { dictionary }),
    "Schulze Dining Hall menu",
  );
  assert.doesNotMatch(
    await expandCampusPlaceAliases("is the caf open", { dictionary }),
    /cafeteria/,
  );
});

test("matches whole phrases and not aliases inside other words", async () => {
  assert.equal(
    await expandCampusPlaceAliases("Where is the academic calendar?", { dictionary }),
    "Where is the academic calendar?",
  );
});

test("adds each distinct matched facility once", async () => {
  assert.equal(
    await expandCampusPlaceAliases("is the caf closer than the ac", { dictionary }),
    "is the caf closer than the ac Schulze Dining Hall Activity Center",
  );
});

test("skips an alias that maps to multiple facilities", async () => {
  const ambiguousDictionary = async () => [
    { id: 1, name: "Activity Center", normalized_alias: "gym" },
    { id: 3, name: "Legacy Gym", normalized_alias: "gym" },
  ];
  assert.equal(
    await expandCampusPlaceAliases("where is the gym", { dictionary: ambiguousDictionary }),
    "where is the gym",
  );
});
