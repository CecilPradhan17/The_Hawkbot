import test from "node:test";
import assert from "node:assert/strict";
import { shouldSkipChatLimit } from "../src/middleware/rateLimiter.js";

test("chat rate limit skips the configured admin account", () => {
  process.env.HOURS_ADMIN_EMAIL = "Admin@ulm.edu";

  assert.equal(shouldSkipChatLimit({ user: { email: "admin@ulm.edu" } }), true);
});

test("chat rate limit still applies to non-admin accounts", () => {
  process.env.HOURS_ADMIN_EMAIL = "admin@ulm.edu";

  assert.equal(shouldSkipChatLimit({ user: { email: "student@ulm.edu" } }), false);
  assert.equal(shouldSkipChatLimit({ user: {} }), false);
});

test("chat rate limit fails closed when admin is not configured", () => {
  delete process.env.HOURS_ADMIN_EMAIL;

  assert.equal(shouldSkipChatLimit({ user: { email: "admin@ulm.edu" } }), false);
});
