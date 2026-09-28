import test from "node:test";
import assert from "node:assert/strict";
import { voteOnPost } from "../src/services/vote.services.js";

const createVoteDatabase = ({ voteCount = 3 } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id, type")) {
        return { rows: [{ id: 10, type: "verification", parent_id: null, status: "pending" }] };
      }
      if (text.includes("SELECT vote FROM post_votes")) return { rows: [] };
      if (text.includes("SELECT vote_count")) return { rows: [{ vote_count: voteCount }] };
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, client, calls };
};

test("a verification reaching the positive threshold reconfirms inside the vote transaction", async () => {
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

  assert.deepEqual(result, { voteCount: 3, status: "approved" });
  assert.deepEqual(resolutions, [[client, 10, "approved"]]);
  assert.equal(ordinaryApprovals, 0);
  assert.match(calls.find(({ text }) => text.includes("SELECT id, type")).text, /FOR UPDATE/);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("a verification reaching the negative threshold marks the result disapproved", async () => {
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

  assert.deepEqual(result, { voteCount: -3, status: "disapproved" });
  assert.deepEqual(resolutions, [{ postId: 10, status: "disapproved" }]);
});

test("a failed verification resolution rolls the entire vote back", async () => {
  const { database, calls } = createVoteDatabase({ voteCount: 3 });
  await assert.rejects(
    voteOnPost(
      { userId: 4, postId: 10, vote: 1 },
      {
        database,
        approvalThreshold: 3,
        verificationResolver: async () => { throw new Error("resolution failed"); },
      },
    ),
    /resolution failed/,
  );
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
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
