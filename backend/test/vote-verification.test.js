import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveApprovalThreshold,
  resolveThresholdTracking,
  voteOnPost,
} from "../src/services/vote.services.js";

const createVoteDatabase = ({
  voteCount = 3,
  thresholdCrossedAt = null,
  thresholdDirection = null,
} = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id, type")) {
        return { rows: [{
          id: 10,
          type: "verification",
          parent_id: null,
          status: "pending",
          vote_count: voteCount,
          threshold_crossed_at: thresholdCrossedAt,
          threshold_direction: thresholdDirection,
        }] };
      }
      if (text.includes("SELECT vote FROM post_votes")) return { rows: [] };
      if (text.includes("SELECT vote_count")) return { rows: [{ vote_count: voteCount }] };
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, client, calls };
};

test("a verification reaching the positive threshold starts a grace period", async () => {
  const { database, client, calls } = createVoteDatabase({ voteCount: 3 });
  const resolutions = [];
  let ordinaryApprovals = 0;
  const result = await voteOnPost(
    { userId: 4, postId: 10, vote: 1 },
    {
      database,
      approvalThreshold: 3,
      verificationResolver: async (...args) => resolutions.push(args),
      postApproval: async () => { ordinaryApprovals += 1; },
      answerApproval: async () => { ordinaryApprovals += 1; },
    },
  );

  assert.deepEqual(result, { voteCount: 3, status: "pending", userVote: 1, accepted: true });
  assert.deepEqual(resolutions, []);
  assert.equal(ordinaryApprovals, 0);
  assert.match(calls.find(({ text }) => text.includes("SELECT id, type")).text, /FOR UPDATE/);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
  const trackingUpdate = calls.find(({ text }) => text.includes("SET threshold_crossed_at"));
  assert.equal(trackingUpdate.params[1], 1);
});

test("a verification reaching the negative threshold remains open during the grace period", async () => {
  const { database } = createVoteDatabase({ voteCount: -3 });
  const resolutions = [];
  const result = await voteOnPost(
    { userId: 4, postId: 10, vote: -1 },
    {
      database,
      approvalThreshold: 3,
      verificationResolver: async (_client, postId, status) => resolutions.push({ postId, status }),
    },
  );

  assert.deepEqual(result, { voteCount: -3, status: "pending", userVote: -1, accepted: true });
  assert.deepEqual(resolutions, []);
});

test("an overdue verification finalizes before accepting another vote", async () => {
  const now = new Date("2026-10-13T18:30:00.000Z");
  const { database, calls } = createVoteDatabase({
    voteCount: 3,
    thresholdCrossedAt: new Date(now.getTime() - 15 * 60 * 1000),
    thresholdDirection: 1,
  });
  const resolutions = [];
  const result = await voteOnPost(
    { userId: 4, postId: 10, vote: -1 },
    {
      database,
      approvalThreshold: 3,
      now,
      verificationResolver: async (...args) => resolutions.push(args),
    },
  );

  assert.deepEqual(result, { voteCount: 3, status: "approved", userVote: null, accepted: false });
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0][1], 10);
  assert.equal(resolutions[0][2], "approved");
  assert.equal(calls.some(({ text }) => text.includes("INSERT INTO post_votes")), false);
});

test("a failed overdue verification resolution rolls finalization back", async () => {
  const now = new Date("2026-10-13T18:30:00.000Z");
  const { database, calls } = createVoteDatabase({
    voteCount: 3,
    thresholdCrossedAt: new Date(now.getTime() - 15 * 60 * 1000),
    thresholdDirection: 1,
  });
  await assert.rejects(
    voteOnPost(
      { userId: 4, postId: 10, vote: 1 },
      {
        database,
        approvalThreshold: 3,
        now,
        verificationResolver: async () => { throw new Error("resolution failed"); },
      },
    ),
    /resolution failed/,
  );
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
});

test("falling back below the threshold clears the grace period", () => {
  const tracking = resolveThresholdTracking({
    voteCount: 2,
    threshold: 3,
    crossedAt: new Date("2026-10-13T18:00:00.000Z"),
    direction: 1,
  });
  assert.deepEqual(tracking, { crossedAt: null, direction: null });
});

test("rejects an invalid vote threshold before opening a database connection", async () => {
  let connected = false;
  await assert.rejects(
    voteOnPost(
      { userId: 4, postId: 10, vote: 1 },
      { database: { async connect() { connected = true; } }, approvalThreshold: "invalid" },
    ),
    /must be a positive number/,
  );
  assert.equal(connected, false);
});

test("uses a safe approval threshold when deployment configuration is absent", () => {
  assert.equal(resolveApprovalThreshold(null), 5);
});
