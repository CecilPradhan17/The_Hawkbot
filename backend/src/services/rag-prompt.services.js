export const RAG_FRESHNESS_INSTRUCTION = `Candidate metadata includes approvedAt and lastVerifiedAt.
Freshness never overrides relevance: do not select a newer candidate unless it directly answers the question.
Use all directly relevant candidates whose claims are compatible, regardless of age.
Only when directly relevant candidates make mutually incompatible claims about the same subject, prefer the candidate with the newest lastVerifiedAt.
If conflicting candidates have the same lastVerifiedAt or no lastVerifiedAt, prefer the newest approvedAt.
If conflicting candidates remain equally current after both comparisons, set answerable to false, return an empty response and no relevant candidate IDs rather than guessing.
Never combine mutually incompatible claims.`;
