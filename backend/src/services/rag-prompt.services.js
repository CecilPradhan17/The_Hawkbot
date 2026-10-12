export const RAG_FRESHNESS_INSTRUCTION = `Candidate metadata includes approvedAt and lastVerifiedAt.
Freshness never overrides relevance: do not select a newer candidate unless it directly answers the question.
Use all directly relevant candidates whose claims are compatible, regardless of age.
Only when directly relevant candidates make mutually incompatible claims about the same subject, prefer the candidate with the newest lastVerifiedAt.
If conflicting candidates have the same lastVerifiedAt or no lastVerifiedAt, prefer the newest approvedAt.
If conflicting candidates remain equally current after both comparisons, set answerable to false, return an empty response and no relevant candidate IDs rather than guessing.
Never combine mutually incompatible claims.`;

export const RAG_SCOPE_INSTRUCTION = `For a broad question asking what a campus office, center, or facility does, has, provides, or offers, directly relevant evidence may support a useful non-exhaustive answer even when it does not list every service.
State the supported information as an example, such as "One service the center offers is..." or "The available campus information confirms...".
Never describe a partial example as a complete list, and never invent additional services.`;
