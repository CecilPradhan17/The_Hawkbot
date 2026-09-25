import "dotenv/config";
import { readFile } from "node:fs/promises";
import pool from "./db.js";
import { expandCampusPlaceAliases } from "./services/campus-place-alias.services.js";
import { generateQueryEmbedding } from "./services/embedding.services.js";
import { isConfidentCandidate, retrieveKnowledgeCandidates } from "./services/rag-retrieval.services.js";
import { findRelevantRank, summarizeRetrievalEvaluation } from "./services/rag-evaluation.services.js";

const percent = value => `${(value * 100).toFixed(1)}%`;

const run = async () => {
  const suite = JSON.parse(await readFile(
    new URL("../evals/rag-retrieval-cases.json", import.meta.url),
    "utf8",
  ));
  const results = [];

  for (const evaluationCase of suite.cases) {
    const retrievalQuery = await expandCampusPlaceAliases(evaluationCase.query);
    const embedding = await generateQueryEmbedding(retrievalQuery);
    const candidates = (await retrieveKnowledgeCandidates(embedding, retrievalQuery))
      .filter(isConfidentCandidate);
    const rank = findRelevantRank(evaluationCase, candidates);
    results.push({ query: evaluationCase.query, retrievalQuery, rank });
    console.log(`${rank ? "PASS" : "MISS"} rank=${rank || "-"} ${evaluationCase.query}`);
  }

  const summary = summarizeRetrievalEvaluation(results);
  console.log("\nRetrieval evaluation");
  console.log(`Cases: ${summary.total}`);
  console.log(`Top-1: ${percent(summary.top1)}`);
  console.log(`Top-3: ${percent(summary.top3)}`);
  console.log(`Top-10: ${percent(summary.top10)}`);
  console.log(`MRR: ${summary.mrr.toFixed(3)}`);

  if (summary.failures.length) {
    console.log("\nMissed queries:");
    for (const failure of summary.failures) console.log(`- ${failure.query}`);
  }

  if (summary.top3 < suite.minimumTop3Accuracy) {
    throw new Error(`Top-3 accuracy ${percent(summary.top3)} is below required ${percent(suite.minimumTop3Accuracy)}`);
  }
};

run()
  .catch(error => {
    console.error(`Evaluation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
