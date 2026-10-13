import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveKnowledgeForAdmin,
  correctKnowledgeForAdmin,
  createKnowledgeForAdmin,
  improveKnowledgeForAdmin,
} from "../src/services/knowledge-admin-management.services.js";

test("returns optional AI suggestions without storing knowledge", async () => {
  const curatorCalls = [];
  const result = await improveKnowledgeForAdmin({
    content: "  The tutoring center is in Walker Hall and offers evening tutoring.  ",
  }, {
    curator: async input => {
      curatorCalls.push(input);
      return [
        { content: "The tutoring center is in Walker Hall.", reviewCategory: "stable" },
        { content: "The tutoring center offers evening tutoring.", reviewCategory: "term" },
      ];
    },
  });

  assert.deepEqual(curatorCalls, [{
    type: "post",
    content: "The tutoring center is in Walker Hall and offers evening tutoring.",
  }]);
  assert.deepEqual(result, {
    suggestions: [
      { content: "The tutoring center is in Walker Hall.", reviewCategory: "stable" },
      { content: "The tutoring center offers evening tutoring.", reviewCategory: "term" },
    ],
  });
});

test("does not call AI for invalid improvement input", async () => {
  let curated = false;
  await assert.rejects(improveKnowledgeForAdmin({ content: "No" }, {
    curator: async () => { curated = true; return []; },
  }), (error) => error.status === 400 && error.message === "Source material must be between 5 and 10000 characters");
  assert.equal(curated, false);
});

test("rejects an AI improvement with no usable suggestions", async () => {
  await assert.rejects(improveKnowledgeForAdmin({ content: "Some valid source material." }, {
    curator: async () => [{ content: "", reviewCategory: "stable" }],
  }), (error) => error.status === 502 && error.message === "AI could not produce usable knowledge suggestions");
});

test("creates sourced embedded knowledge and records the administrator", async () => {
  const calls = [];
  const databaseCalls = [];
  const database = {
    async query(text, params) {
      databaseCalls.push({ text, params });
      return { rows: [] };
    },
  };
  const verifiedAt = new Date("2026-10-12T15:00:00Z");
  const storageCalls = [];
  const storage = async options => {
    storageCalls.push(options);
    const stored = [{ id: 101, content: options.chunks[0].content, reviewCategory: options.chunks[0].reviewCategory }];
    await options.afterStore({
      client: { async query(text, params) { calls.push({ text, params }); } },
      stored,
      verifiedAt,
    });
    return stored;
  };
  const embeddingGenerator = async () => [0.1];

  const result = await createKnowledgeForAdmin({
    adminUserId: 3,
    content: "  The Registrar is located in Sandel Hall.  ",
    reviewCategory: "stable",
    sourceTitle: "  ULM Registrar website  ",
    sourceUrl: "https://www.ulm.edu/registrar",
  }, { database, embeddingGenerator, storage });

  assert.deepEqual(result, {
    created: { id: 101, content: "The Registrar is located in Sandel Hall.", reviewCategory: "stable" },
  });
  assert.deepEqual(storageCalls[0], {
    db: database,
    sourcePostId: null,
    sourceUrl: "https://www.ulm.edu/registrar",
    sourceTitle: "ULM Registrar website",
    rawContent: "The Registrar is located in Sandel Hall.",
    chunks: [{ content: "The Registrar is located in Sandel Hall.", reviewCategory: "stable" }],
    generateEmbedding: embeddingGenerator,
    afterStore: storageCalls[0].afterStore,
  });
  assert.match(calls[0].text, /'created'/);
  assert.deepEqual(calls[0].params, [101, 3, "Source: ULM Registrar website", verifiedAt]);
  assert.match(databaseCalls[0].text, /status IN \('active', 'needs_update'\)/);
  assert.deepEqual(databaseCalls[0].params, ["The Registrar is located in Sandel Hall.", null]);
});

test("rejects duplicate active knowledge before embedding or storage", async () => {
  let embedded = false;
  let stored = false;
  await assert.rejects(createKnowledgeForAdmin({
    adminUserId: 3,
    content: "  THE REGISTRAR IS LOCATED IN SANDEL HALL.  ",
    reviewCategory: "stable",
    sourceTitle: "ULM Registrar website",
    sourceUrl: "https://www.ulm.edu/registrar",
  }, {
    database: {
      async query(_text, params) {
        assert.deepEqual(params, ["THE REGISTRAR IS LOCATED IN SANDEL HALL.", null]);
        return { rows: [{ id: 44 }] };
      },
    },
    embeddingGenerator: async () => { embedded = true; return [0.1]; },
    storage: async () => { stored = true; },
  }), (error) => error.status === 409 && error.message === "This knowledge already exists as fact #44");
  assert.equal(embedded, false);
  assert.equal(stored, false);
});

for (const [name, override, message] of [
  ["administrator", { adminUserId: 0 }, "Invalid administrator ID"],
  ["content", { content: "No" }, "Knowledge must be between 5 and 2000 characters"],
  ["review category", { reviewCategory: "weekly" }, "Invalid review category"],
  ["source label", { sourceTitle: "?" }, "Source label must be between 3 and 200 characters"],
  ["source URL", { sourceUrl: "http://example.com" }, "Source URL must be a valid HTTPS URL"],
]) {
  test(`validates the admin-created knowledge ${name} before embedding or storage`, async () => {
    let embedded = false;
    let stored = false;
    await assert.rejects(createKnowledgeForAdmin({
      adminUserId: 3,
      content: "The Registrar is located in Sandel Hall.",
      reviewCategory: "stable",
      sourceTitle: "ULM Registrar website",
      sourceUrl: "",
      ...override,
    }, {
      embeddingGenerator: async () => { embedded = true; return [0.1]; },
      storage: async () => { stored = true; },
    }), new RegExp(message));
    assert.equal(embedded, false);
    assert.equal(stored, false);
  });
}

const correctionHarness = ({ status = "active" } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id, status")) {
        return { rowCount: 1, rows: [{ id: 7, status }] };
      }
      if (text.includes("UPDATE knowledge_verifications")) {
        return { rows: [{ post_id: 30 }] };
      }
      if (text.includes("UPDATE knowledge_correction_questions")) {
        return { rows: [{ question_post_id: 40 }] };
      }
      return { rows: [] };
    },
  };
  const verifiedAt = new Date("2026-10-07T15:00:00Z");
  const storageCalls = [];
  const storage = async options => {
    storageCalls.push(options);
    await options.afterStore({
      client,
      stored: [{ id: 99, content: options.chunks[0].content, reviewCategory: options.chunks[0].reviewCategory }],
      verifiedAt,
    });
    return [{ id: 99, content: options.chunks[0].content, reviewCategory: options.chunks[0].reviewCategory }];
  };
  return { calls, storageCalls, storage, verifiedAt };
};

test("creates an embedded replacement and preserves an audit trail", async () => {
  const { calls, storageCalls, storage, verifiedAt } = correctionHarness();
  const embeddingGenerator = async () => [0.1];
  const duplicateQueries = [];
  const database = {
    async query(text, params) {
      duplicateQueries.push({ text, params });
      if (text.includes("SELECT status")) return { rows: [{ status: "active" }] };
      return { rows: [] };
    },
  };
  const result = await correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "  The Library opens at 7:30 AM.  ",
    reviewCategory: "term",
    note: "Updated from the current library notice.",
    sourceTitle: "  ULM Library website  ",
    sourceUrl: "https://www.ulm.edu/library",
  }, { database, embeddingGenerator, storage });

  assert.deepEqual(result, {
    replacedKnowledgeId: 7,
    replacement: { id: 99, content: "The Library opens at 7:30 AM.", reviewCategory: "term" },
  });
  assert.equal(storageCalls[0].db, database);
  assert.equal(storageCalls[0].sourcePostId, null);
  assert.equal(storageCalls[0].sourceTitle, "ULM Library website");
  assert.equal(storageCalls[0].sourceUrl, "https://www.ulm.edu/library");
  assert.equal(storageCalls[0].rawContent, "The Library opens at 7:30 AM.");
  assert.equal(storageCalls[0].generateEmbedding, embeddingGenerator);
  assert.deepEqual(storageCalls[0].chunks, [{
    content: "The Library opens at 7:30 AM.",
    reviewCategory: "term",
  }]);
  assert.match(duplicateQueries[0].text, /SELECT status/);
  assert.deepEqual(duplicateQueries[0].params, [7]);
  assert.match(duplicateQueries[1].text, /id <> \$2/);
  assert.deepEqual(duplicateQueries[1].params, ["The Library opens at 7:30 AM.", 7]);

  const replace = calls.find(({ text }) => text.includes("SET status = 'replaced'"));
  assert.deepEqual(replace.params, [99, 7]);
  assert.equal(calls.filter(({ text }) => text.includes("UPDATE posts SET status = 'closed'")).length, 2);
  const correction = calls.find(({ text }) => text.includes("UPDATE knowledge_correction_questions"));
  assert.match(correction.text, /status = 'resolved'/);
  assert.match(correction.text, /replacement_knowledge_id = \$1/);
  assert.deepEqual(correction.params, [99, verifiedAt, 7]);
  const audit = calls.find(({ text }) => text.includes("INSERT INTO knowledge_admin_actions"));
  assert.deepEqual(audit.params, [7, 99, 3, "Updated from the current library notice.", verifiedAt]);
});

test("allows an administrator to replace knowledge already needing an update", async () => {
  const { storage } = correctionHarness({ status: "needs_update" });
  await assert.doesNotReject(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "The corrected fact.",
    reviewCategory: "yearly",
    note: "Corrected after community feedback.",
    sourceTitle: "ULM official notice",
    sourceUrl: "",
  }, {
    storage,
    embeddingGenerator: async () => [0.1],
    statusFinder: async () => "needs_update",
    duplicateFinder: async () => null,
  }));
});

test("refuses to replace historical knowledge before embedding or storage", async () => {
  let embedded = false;
  let stored = false;
  await assert.rejects(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "The corrected fact.",
    reviewCategory: "yearly",
    note: "Attempted historical edit.",
    sourceTitle: "ULM official notice",
    sourceUrl: "",
  }, {
    statusFinder: async () => "replaced",
    embeddingGenerator: async () => { embedded = true; return [0.1]; },
    storage: async () => { stored = true; },
  }), (error) => (
    error.status === 409 && error.message === "Only active or needs-update knowledge can be corrected"
  ));
  assert.equal(embedded, false);
  assert.equal(stored, false);
});

test("rejects a correction that duplicates another active fact before embedding or storage", async () => {
  let embedded = false;
  let stored = false;
  const finderCalls = [];
  await assert.rejects(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "The Library opens at 7:30 AM.",
    reviewCategory: "term",
    note: "Updated from the current library notice.",
    sourceTitle: "ULM Library website",
    sourceUrl: "https://www.ulm.edu/library",
  }, {
    database: "database",
    statusFinder: async () => "active",
    duplicateFinder: async input => { finderCalls.push(input); return 44; },
    embeddingGenerator: async () => { embedded = true; return [0.1]; },
    storage: async () => { stored = true; },
  }), (error) => error.status === 409 && error.message === "This knowledge already exists as fact #44");
  assert.deepEqual(finderCalls, [{
    database: "database",
    content: "The Library opens at 7:30 AM.",
    excludeId: 7,
  }]);
  assert.equal(embedded, false);
  assert.equal(stored, false);
});

test("rejects a missing correction target before embedding or storage", async () => {
  let embedded = false;
  let stored = false;
  await assert.rejects(correctKnowledgeForAdmin({
    knowledgeId: 404,
    adminUserId: 3,
    content: "The corrected fact.",
    reviewCategory: "yearly",
    note: "Updated from an official notice.",
    sourceTitle: "ULM official notice",
    sourceUrl: "",
  }, {
    statusFinder: async () => null,
    embeddingGenerator: async () => { embedded = true; return [0.1]; },
    storage: async () => { stored = true; },
  }), (error) => error.status === 404 && error.message === "Knowledge fact not found");
  assert.equal(embedded, false);
  assert.equal(stored, false);
});

test("validates corrections before generating embeddings or opening storage", async () => {
  let embedded = false;
  let stored = false;
  await assert.rejects(correctKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    content: "No",
    reviewCategory: "weekly",
    note: "",
  }, {
    embeddingGenerator: async () => { embedded = true; return [0.1]; },
    storage: async () => { stored = true; },
  }), /Corrected knowledge/);
  assert.equal(embedded, false);
  assert.equal(stored, false);
});

for (const [name, override, message] of [
  ["source label", { sourceTitle: "?" }, "Source label must be between 3 and 200 characters"],
  ["source URL", { sourceUrl: "http://example.com" }, "Source URL must be a valid HTTPS URL"],
]) {
  test(`validates correction ${name} before embedding or storage`, async () => {
    let embedded = false;
    let stored = false;
    await assert.rejects(correctKnowledgeForAdmin({
      knowledgeId: 7,
      adminUserId: 3,
      content: "The corrected fact.",
      reviewCategory: "yearly",
      note: "Updated from an official notice.",
      sourceTitle: "ULM official notice",
      sourceUrl: "",
      ...override,
    }, {
      embeddingGenerator: async () => { embedded = true; return [0.1]; },
      storage: async () => { stored = true; },
    }), new RegExp(message));
    assert.equal(embedded, false);
    assert.equal(stored, false);
  });
}

const archiveHarness = ({ status = "active", found = true } = {}) => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (text.includes("SELECT id, status")) {
        return found
          ? { rowCount: 1, rows: [{ id: 7, status }] }
          : { rowCount: 0, rows: [] };
      }
      if (text.includes("UPDATE knowledge_verifications")) {
        return { rows: [{ post_id: 30 }] };
      }
      if (text.includes("UPDATE knowledge_correction_questions")) {
        return { rows: [{ question_post_id: 40 }] };
      }
      return { rows: [] };
    },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { database: { async connect() { return client; } }, calls };
};

test("archives knowledge without deleting it and closes obsolete workflows", async () => {
  const { database, calls } = archiveHarness();
  const archivedAt = new Date("2026-10-07T16:00:00Z");
  const result = await archiveKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    note: "This service is no longer offered.",
  }, { database, now: archivedAt });

  assert.deepEqual(result, { id: 7, status: "archived", archivedAt });
  const archive = calls.find(({ text }) => text.includes("SET status = 'archived'"));
  assert.deepEqual(archive.params, [7]);
  assert.equal(calls.filter(({ text }) => text.includes("UPDATE posts SET status = 'closed'")).length, 2);
  const audit = calls.find(({ text }) => text.includes("INSERT INTO knowledge_admin_actions"));
  assert.deepEqual(audit.params, [7, 3, "This service is no longer offered.", archivedAt]);
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["COMMIT", "RELEASE"]);
});

test("archives needs-update knowledge and cancels its correction request", async () => {
  const { database, calls } = archiveHarness({ status: "needs_update" });
  await archiveKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    note: "The outdated fact should not be replaced.",
  }, { database });

  const correction = calls.find(({ text }) => text.includes("UPDATE knowledge_correction_questions"));
  assert.match(correction.text, /status = 'cancelled'/);
});

test("refuses to archive historical knowledge and rolls back", async () => {
  const { database, calls } = archiveHarness({ status: "replaced" });
  await assert.rejects(archiveKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    note: "Do not mutate historical records.",
  }, { database }), (error) => (
    error.status === 409 && error.message === "Only active or needs-update knowledge can be archived"
  ));
  assert.deepEqual(calls.slice(-2).map(({ text }) => text), ["ROLLBACK", "RELEASE"]);
});

test("validates archive requests before opening a transaction", async () => {
  let connected = false;
  await assert.rejects(archiveKnowledgeForAdmin({
    knowledgeId: 7,
    adminUserId: 3,
    note: "",
  }, {
    database: { async connect() { connected = true; } },
  }), /Archive note/);
  assert.equal(connected, false);
});
