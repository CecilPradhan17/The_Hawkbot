import test from "node:test";
import assert from "node:assert/strict";
import { requireHoursAdmin } from "../src/middleware/hoursAdmin.middleware.js";

const runMiddleware = user => {
  let nextValue;
  requireHoursAdmin({ user }, {}, value => { nextValue = value ?? "next"; });
  return nextValue;
};

test("allows the configured owner email case-insensitively", () => {
  process.env.HOURS_ADMIN_EMAIL = "Owner@ulm.edu";
  assert.equal(runMiddleware({ email: "owner@ulm.edu" }), "next");
});

test("rejects any other authenticated user", () => {
  process.env.HOURS_ADMIN_EMAIL = "owner@ulm.edu";
  const error = runMiddleware({ email: "student@ulm.edu" });
  assert.equal(error.status, 403);
  assert.equal(error.message, "Forbidden");
});

test("fails closed when owner access is not configured", () => {
  delete process.env.HOURS_ADMIN_EMAIL;
  const error = runMiddleware({ email: "owner@ulm.edu" });
  assert.equal(error.status, 503);
});

