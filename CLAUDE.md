# Hawkbot

Hawkbot is a ULM campus assistant plus HawkWall, a community Q&A feed. The core
product rule is grounding: Hawkbot may synthesize answers from retrieved,
approved evidence and structured tools, but it must not invent campus facts from
the model's pretrained knowledge.

This file is the durable project handoff for future coding sessions. For the
reasoning behind major choices, also read `DECISIONS.md`.

## Stack and deployment

- Backend: Node ESM + Express 5 in `backend/src`
- Database: Neon PostgreSQL with pgvector, accessed through `pg`
- AI: OpenAI embeddings plus a grounded answer/curation model
- Frontend: React 19 + TypeScript + Vite + Tailwind v4 in `frontend/src`
- Hosting: frontend on Vercel, backend on Render
- Authentication: JWT with bcrypt-backed users
- PWA: `vite-plugin-pwa`/Workbox; hashed static assets are precached, HTML
  navigations are network-first with one cached offline fallback, and `/api/*`
  is always network-only

Production is real. There are no active users currently, but historical user
data may exist. Treat `DATABASE_URL`, migrations, seed/backfill scripts, pushes,
and deployments as production-affecting. Ask before schema changes, production
writes, pushes, or deployments. Never print or commit `.env` contents.

## Code organization

`backend/src/server.js` boots `app.js`; routes are mounted beneath `/api` from
`routes/index.js`. Keep the existing `routes -> controllers -> services -> db`
layering. Business logic belongs in services rather than controllers.

Frontend API wrappers live in `frontend/src/api`. Authentication is owned by
`context/AuthContext.tsx`; authenticated routes use `routes/ProtectedRoute.tsx`.
Pages live in `frontend/src/pages`.

The workspace is sometimes shared by multiple agents. Always run `git status`
before editing or committing. Do not overwrite, stage, or commit unrelated dirty
files merely because they are present.

## Current Hawkbot answer workflow

`backend/src/services/chatbot.services.js` is the production entry point and
delegates to `chatbot-orchestrator.services.js`. Tool definitions and execution
live in `chatbot-tools.services.js`.

1. Sanitize the current message and bounded conversational state.
2. Try strict deterministic handlers for small talk, recognized structured-hours
   questions, and the Schulze dining-menu link. A clear single-purpose match
   returns immediately without an LLM call. Mixed questions continue to the
   router so a partial canned answer does not discard the rest of the request.
3. On a miss, the configurable `ROUTER_MODEL` (default `gpt-4o-mini`) must choose
   one registered tool using OpenAI tool calling. The production registry offers
   `rag_search` and `facility_hours`. `web_search` is a nonfunctional scaffold
   and is omitted unless `WEB_SEARCH_ENABLED=true`.
4. `rag_search` preserves the existing alias expansion, query embedding, and
   unified retrieval. `unified-retrieval.services.js` starts three bounded
   branches in parallel: approved knowledge/HawkWall evidence, curated official
   resources, and facility candidates.
5. Approved knowledge uses hybrid retrieval in
   `rag-retrieval.services.js`: exact cosine ranking and PostgreSQL full-text
   ranking are fused with reciprocal-rank fusion. Up to 20 rows feed a final
   pool of 10. A knowledge candidate is confident when vector similarity is at
   least `0.50` or full-text search matched it. Hyphens/dashes are normalized
   before `websearch_to_tsquery` so names such as Fant-Ewing are not interpreted
   as exclusion expressions.
6. Official resources and facilities are separately retrieved with vector and
   full-text search, capped at three each. The complete catalogs are not sent to
   the model on every request.
7. Tool results are returned inside explicit untrusted-data delimiters. The model
   may answer or request one additional tool. Code enforces a hard maximum of two
   tool iterations; exhausting the cap, a tool error, or no useful evidence ends
   in the honest HawkWall fallback.
8. The final answer must return the tool-call and evidence IDs it actually used.
   The backend validates those IDs against executed, useful tool results before
   returning any prose. Grounding permits conclusions explicitly stated by or
   reasonably entailed from selected evidence, including combining compatible
   facts and backend-supplied trusted relationships. Every material campus-specific
   premise must still be supplied; the model may not fill gaps from pretrained
   knowledge. Unique facility aliases are selectable, backend-validated relationship
   evidence rather than retrieval hints only. A broad question about what a campus office or center
   “has,” “does,” “provides,” or “offers” may use directly relevant evidence as
   a clearly labeled non-exhaustive example (for example, “One service…”); it
   must not present partial evidence as a complete list or invent other services.
   When evidence supports only part of a request, give that useful part and state
   the unsupported remainder. Dates, deadlines, prices, eligibility, policy
   exceptions, safety, and current operating status require explicit premises.
9. One privacy-bounded structured log event is emitted per completed request with
   its route, deterministic matcher, ordered tools, loop depth, RAG similarities,
   per-stage latency, total latency, and available token usage. Question text is
   not logged.

Approved knowledge retrieval remains the primary branch: its SQL errors propagate
out of `unified-retrieval.services.js` rather than being converted into an empty
candidate set. The orchestrator treats that as an explicit failed tool execution,
logs the failure metadata, and returns the safe fallback instead of a 500. Optional
official-resource and facility branches may still degrade independently when their
schema is unavailable. Avoid logging private question text.

## Conversation state and clarification

`frontend/src/pages/Chatbot.tsx` persists rendered chat state in
`sessionStorage`, scoped by user ID. It survives route changes and refreshes in
the same browser tab/PWA window, but closing that tab/window clears it. It does
not sync across devices.

The frontend sends at most eight recent turns. The backend treats earlier model
prose as conversational context, never factual evidence. Hawkbot may ask up to
two clarification questions for one unresolved request. Each clarification
round reconstructs retrieval from the original query, prior clarification
questions/answers, and the current reply. After the limit, the model must give
the best grounded answer or fall back.

## Evidence sources

### Community-approved knowledge

When a HawkWall answer crosses `VOTE_APPROVAL_THRESHOLD`,
`approval.services.js` curates the question plus answer into self-contained
atomic facts, embeds every fact, and stores them transactionally in
`approved_knowledge`. The question supplies subject/context so a terse answer
such as “yes” is not stored without meaning. Source post lineage is retained so
selected evidence can open its isolated read-only discussion page.

The code-level approval threshold defaults to five votes when
`VOTE_APPROVAL_THRESHOLD` is absent. A valid positive environment value still
overrides that default. Do not reintroduce the prior behavior where missing
configuration caused every vote request to fail before reaching PostgreSQL.

### Official resources

`official_resources` and `official_resource_aliases` contain reviewed ULM URLs,
descriptions, aliases, priority, and verification metadata. They are curated
destinations, not scraped page contents. The LLM may recommend only retrieved
resource IDs and must not claim it read a linked page.

Schulze menu questions are intentionally link-only. Hawkbot does not call the
undocumented MyDiningHub endpoint, scrape it, cache it, or describe current menu
items. The fixed official page is owned by
`dining-menu-link.services.js`; the frontend renders it as a prominent inline
“Open the current menu” link rather than a generic Sources footer. Explicit
canonical “Schulze” menu/serving questions do not depend on the facility-alias
table. Configured aliases such as “caf” still resolve through the database, and
unusual or misspelled wording may fall through to the constrained AI menu tool.
Dining-hours questions remain separate.

### Structured facility hours

Facility schedules are normalized data, not RAG text. Recognized hours questions
are resolved deterministically with precedence:

`exact-date exception -> named special period -> regular weekly hours`

The timezone is `America/Chicago`. Upload/extraction is reviewed before atomic
publication; current schedules replace prior schedules. See `HOURS_SYSTEM.md`.
The LLM sees only retrieved facility candidates and may request a validated
lookup when deterministic routing did not fully handle the question.

## Knowledge lifecycle and administration

Knowledge statuses include `active`, `needs_update`, `replaced`, and `archived`.
Review categories are `stable`, `yearly`, `term`, and `frequent`. Verification,
outdated-report, and correction-question workflows preserve history rather than
editing evidence in place.

The protected `/api/knowledge-admin` API and `KnowledgeAdmin.tsx` support:

- listing, filtering, searching, and paginating knowledge;
- viewing source labels, URLs, source posts, review metadata, and replacement
  lineage;
- changing review categories and queuing community review;
- archiving active or needs-update knowledge with an audit note;
- correcting knowledge by creating an embedded replacement, marking the old
  fact replaced, preserving source metadata, resolving open workflows, and
  recording an administrator action;
- manually creating sourced, embedded facts with administrator audit records;
- optionally asking AI to split source material into atomic suggestions. This
  is preview-only: an administrator must review and submit the final text.

Create/correct paths reject duplicate active or needs-update facts before paying
for embeddings. Historical rows are read-only. Never change a replaced/archived
row in place or destroy audit lineage.

`HOURS_ADMIN_EMAIL` currently controls both hours administration and knowledge
administration through the existing owner middleware.

## Embeddings and integrity

All evidence uses `text-embedding-3-large` (3072 dimensions). New approved
knowledge, official resources, and facilities generate/update embeddings in
their normal write paths. Active approved knowledge is not allowed to have a
null embedding after migration 029.

Operational commands:

- `cd backend && npm run backfill:evidence` embeds missing active knowledge,
  official resources, and facilities, then verifies none remain missing.
- `cd backend && npm run check:evidence` performs a read-only integrity check.
- `cd backend && npm run eval:retrieval` runs the retrieval golden set against
  the configured Neon/OpenAI environment.

Run production backfills only with explicit approval. A successful local/unit
test does not prove Neon connectivity; school Wi-Fi has repeatedly timed out on
port 5432. Report live verification separately from code-level verification.

## Migrations and seed data

Migrations are numbered SQL files in `backend/migrations` and are applied
manually/sequentially in Neon's SQL editor. Never edit an already-applied
migration; add the next number. The known production sequence has been applied
through `029_require_active_knowledge_embeddings.sql`.

When a migration adds active evidence with null embeddings, run the evidence
backfill before validating the migration-029 constraint. Normal application
write paths must create the embedding before activating evidence.

`backend/knowledge.json` is reviewed seed material with official provenance.
`025_migrate_legacy_knowledge.sql` blanket-replaced unsourced legacy rows and
inserted a manually reviewed subset. That conversion was incomplete: valid
legacy topics such as the Honors Lounge may have been dropped. Do not repair
this with isolated one-off facts. The remaining task is a full reconciliation:

1. inventory every legacy fact from the pre-025 history;
2. group duplicates and assign structured-hours/menu ownership where relevant;
3. verify each remaining topic against a current official source;
4. add a sourced replacement or record an explicit outdated/unverifiable
   disposition;
5. produce a coverage report and regression check proving no legacy fact was
   silently lost.

## Frontend behavior worth preserving

- HawkWall uses indexed keyset pagination on `(created_at, id)` and infinite
  scrolls 10 posts at a time.
- User-scoped HawkWall state is retained across route navigation. Within 120
  seconds it is reused; after that the newest page is refetched in the
  background and pagination restarts from the refreshed first page.
- A compact Hawkbot prompt sits above the feed and transfers its question to
  the dedicated chat page without issuing a duplicate request.
- Desktop and mobile use the left navigation system; logout clears auth and
  returns to the public landing page.
- The main posting action is “Post.” Its modal supports question and regular
  post modes rather than exposing competing create buttons.
- HawkWall citations open `/sources/hawkwall/:postId`, an isolated approved
  discussion view, rather than dumping the user into the full feed.
- PWA API responses are network-only. Never cache authenticated feed/chat/vote
  responses in the service worker.
- PWA navigations are `NetworkFirst` using the versioned `html-app-shell-v2`
  cache. Do not restore stale-while-revalidate for HTML: an old cached shell can
  reference JS/CSS hashes removed by a later Vercel deployment, producing a
  white screen and non-JavaScript/non-CSS MIME errors. `index.html`, `sw.js`,
  and the web manifest are explicitly revalidated; hashed `/assets/*` remain
  immutable.

## Commands and validation

- Backend dev: `cd backend && npm run dev` (port 4005)
- Backend tests: `cd backend && npm test`
- Frontend dev: `cd frontend && npm run dev` (port 5173)
- Frontend build/typecheck: `cd frontend && npm run build`
- Frontend lint: `cd frontend && npm run lint`

Use tests proportional to the change. For retrieval fixes, add a regression at
the stage that failed (context construction, SQL candidate retrieval, LLM
grounding, or controller response) rather than adding a special-case answer.

## Current handoff snapshot — 2026-10-14

- `main` includes unified evidence retrieval, bounded clarification context,
  evidence embedding integrity/backfill, sourced legacy migration, the full
  admin create/correct/archive/improve UI/API, validation-before-embedding for
  corrections, the network-first PWA shell fix, expanded official-resource
  routing, inline dining-menu links, and the menu/service grounding fixes.
- The concise-query retrieval repair is in `b3d1ca5`. The real configured LLM
  successfully selected the on-campus-jobs evidence/resource and the
  Fant-Ewing fact when those candidates were supplied. Direct live Neon
  retrieval could not be retested from the current network because port 5432
  timed out.
- The working tree was clean at the start of this documentation update. Still
  inspect `git status` before acting because multiple agents commonly share the
  checkout.
- The admin knowledge-management work is complete for the current scope. The
  final backend regression run passed 243/243 tests; the related frontend
  production build and focused lint checks also passed. No additional migration
  is pending for this workflow. Admin creation and correction both reject exact
  active/needs-update duplicates before embedding, and corrections preflight the
  target status before embedding while rechecking it under lock during storage.
- The highest-priority unresolved data task is the systematic legacy-knowledge
  reconciliation described above. The highest-priority runtime check is to
  retest representative clean and history-bearing queries after Render deploy:
  “where can I get on campus jobs?”, “what is Fant-Ewing Coliseum?”, “where is
  the Honors Lounge?”, “what is Schulze serving today?”, and “what do they have
  at the SSC?”. The last query should give a qualified supported example rather
  than treating one known service as a complete inventory.
- The production chat path now uses the registered-tool cascade described above.
  The older dependency-injected flow remains temporarily inside
  `chatbot.services.js` only to preserve established focused fixtures; migrate
  those fixtures to the registry interface before deleting that compatibility
  branch.

## Collaboration style

For architecture or nontrivial product changes, discuss the design, trade-offs,
and connection to the existing system before implementation. Small scoped fixes
may be implemented directly. Preserve unrelated work, flag technical debt
without expanding scope, and never push/deploy unless explicitly requested.

The owner prefers work in small reviewable chunks: finish one chunk, explain
each change briefly, report the relevant tests, and wait for approval before
committing. In this project, the owner's message `cp` explicitly means “commit
and push the reviewed chunk,” then begin the next agreed chunk. Stage only the
files belonging to the current chunk because other agents may have concurrent
changes in the shared checkout.

Record significant architectural choices in `DECISIONS.md` with date, context,
decision, alternatives, trade-offs, and a resume/interview angle.
