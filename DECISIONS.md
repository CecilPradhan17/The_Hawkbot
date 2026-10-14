# Decision log

Running record of major architectural decisions and trade-offs on Hawkbot — kept so
Cecil has real receipts for resume bullets, interviews, and portfolio writeups, not
just a vague memory of "I built a chatbot."

Newest entries at the top. Template for new entries:

```
## YYYY-MM-DD — Title

**Context:** What problem or constraint forced a decision.

**Decision:** What was actually built/chosen.

**Alternatives considered:** What else was on the table and why it lost.

**Trade-offs:** What was given up to get this.

**Resume/interview angle:** What this demonstrates, impact if measurable.
```

---

## 2026-10-14 — Hawkbot uses a capped registered-tool cascade

**Context:** Hawkbot's grounded synthesis call could select hours and menu tools,
but retrieval and orchestration were coupled in one service and were difficult to
extend or observe. The product needs cheap deterministic handling for exact cases,
model-driven routing for varied student language, and a hard code boundary that
prevents an open-ended agent loop or an unsupported final answer.

**Decision:** Keep strict deterministic small-talk, hours, and dining checks first.
On a miss, a configurable inexpensive model selects from a registry whose initial
tools are existing unified RAG and structured facility hours. Tool outputs are
delimited and treated as untrusted data. The model may answer after a useful result
or request one additional tool, while code enforces a two-iteration cap and validates
every selected tool-call and evidence ID. Empty results, invalid selections, tool
errors, router errors, and cap exhaustion return the established honest fallback.
Web search exists only as a disabled registry scaffold pending an allowlisted design.
One structured, content-free observability event records routing, tools, similarities,
latencies, and available token usage.

**Alternatives considered:** Keep expanding one monolithic synthesis prompt, build
separate hardcoded branches for every new capability, or allow an autonomous agent
to continue until it decides it is finished. The monolith obscures routing and tool
cost; hardcoded branches do not handle varied language; an uncapped agent weakens
latency, cost, and grounding guarantees.

**Trade-offs:** A non-deterministic request now usually needs a routing call followed
by a final-answer call, increasing latency and token cost. The two-iteration cap may
fall back on a question that another iteration could answer. A temporary legacy path
remains for existing dependency-injected tests and should be removed after their
fixtures move to the registry interface.

**Resume/interview angle:** Refactored a grounded RAG assistant into an extensible,
observable tool-calling cascade with defense against prompt injection, deterministic
termination, evidence-ID validation, and graceful degradation.

## 2026-10-13 — Grounding permits bounded inference over selected evidence

**Context:** Requiring a retrieved sentence to directly repeat the requested fact made
Hawkbot reject useful answers that followed from approved evidence. For example, the
system could know both that “gym” uniquely refers to the Activity Center and that the
Activity Center provides fitness facilities, yet still treat “Where is the gym?” as
unanswerable. A general-purpose model can make that connection, but allowing unrestricted
pretrained knowledge would weaken Hawkbot's campus-grounding guarantee.

**Decision:** Define grounding as explicit support or reasonable entailment from selected
evidence. The answer model may combine compatible approved facts, official-resource
descriptions, structured results, and backend-supplied trusted relationships. Every
material campus-specific premise must still be present in that evidence. Unique facility
aliases are now passed as ID-labeled relationships that the model must select, and both
the model adapter and orchestration layer validate selected relationship IDs against the
backend-provided pool. Partial support produces a qualified useful answer rather than an
all-or-nothing fallback. Dates, deadlines, prices, eligibility, policy exceptions, safety,
and current operating status retain a stricter no-inference rule unless every premise is
explicitly supplied.

**Alternatives considered:** Loosen the prompt to let the model use general knowledge, or
continue requiring direct sentence-level answers. Unrestricted model knowledge improves
coverage but can invent changing campus facts; direct-only grounding is safe but discards
valid conclusions and makes answer quality depend too heavily on exact wording.

**Trade-offs:** Entailment remains probabilistic, so regression coverage and validated
evidence selection are important. The relationship mechanism initially exposes facility
aliases; additional governed relationship types can be added as structured campus data
becomes available. In exchange, Hawkbot can answer a much broader range of paraphrases,
multi-fact questions, comparisons, and partial requests without abandoning provenance.

**Resume/interview angle:** Evolved a retrieval system from extractive sentence matching
to validated evidence-based reasoning, increasing answer coverage while preserving a
hard boundary against unsupported domain claims.

## 2026-10-12 — AI-assisted admin knowledge requires human approval

**Context:** The owner needs to add official knowledge directly without routing it
through community voting. An LLM can improve retrieval quality by splitting source
material into self-contained facts, but silently saving rewritten text could alter a
name, date, condition, or other authoritative detail.

**Decision:** Treat AI curation as an optional preview step. The model may suggest
atomic wording and review categories, but an administrator must inspect and approve
the final facts before any embedding or database write occurs. Directly submitted
facts are stored exactly as approved, with source metadata and an administrator audit
record.

**Alternatives considered:** Automatically curate and save every submission, or skip
AI assistance entirely. Automatic saving is faster but makes model mistakes durable;
skipping curation preserves fidelity but makes long, multi-topic entries harder to
retrieve accurately.

**Trade-offs:** Adding knowledge takes one additional review step and optional AI use
adds a small per-submission cost. In exchange, the model cannot silently publish campus
claims, while administrators still get help producing retrieval-friendly atomic facts.

**Resume/interview angle:** Designed a human-in-the-loop ingestion workflow that uses
LLMs for structured assistance without surrendering editorial control or provenance.

## 2026-10-06 — Chat history is tab-scoped and evidence opens outside the feed

**Context:** Following a HawkWall citation unmounted the chat and lost its local
conversation. Citations also opened the full HawkWall feed, making it difficult to
inspect the exact evidence and return to the answer.

**Decision:** Persist each user's rendered chat messages in `sessionStorage`, keyed by
user ID, so navigation and refreshes in the same tab restore the conversation while
closing the tab clears it. HawkWall citations now open a dedicated read-only evidence
route that shows the isolated thread, highlights the exact source post, preserves
moderation labels, and links directly back to Hawkbot.

**Alternatives considered:** Global React state would survive route changes but not a
refresh; `localStorage` or server-side transcripts would retain conversations beyond the
tab and require a separate privacy and deletion policy.

**Trade-offs:** In-flight requests are not resumed, and conversation history does not
sync across tabs or devices. That matches the requested tab lifetime without creating a
durable chat-history product.

**Resume/interview angle:** Added privacy-bounded client persistence and a focused
evidence-inspection workflow with account isolation and source-level highlighting.

## 2026-10-06 — RAG answers preserve inspectable HawkWall provenance

**Context:** Hawkbot could select several approved facts, but returned only a synthesized
answer and internal knowledge IDs. Students could not inspect the community evidence or
see when multiple discussions contributed to an answer.

**Decision:** Return one structured HawkWall citation per selected source post, including
its thread, excerpt, approval count, and verification date. Citation links open the
original approved question and its complete moderated reply history. Retrieval still
filters relevance; citations include every source the grounded answer actually selects,
not every nearest-neighbor candidate.

**Alternatives considered:** Link only the top-ranked fact, or show all ten retrieved
candidates. The former hides corroboration and disagreement; the latter exposes noisy
results the answer did not use.

**Trade-offs:** This makes provenance visible but does not yet classify contradictions.
Conflict grouping remains a separate response-composition layer.

**Resume/interview angle:** Added end-to-end evidence lineage from vector retrieval to a
deep-linked community discussion while preserving moderation state and closed voting.

## 2026-10-01 — Official resources are a curated directory, not scraped knowledge

**Context:** Hawkbot needs to help with information that has not yet been contributed
to HawkWall, while avoiding the maintenance and authorization burden of scraping.

**Decision:** Store reviewed URLs, descriptions, response copy, priorities, and aliases
in PostgreSQL. Match clear navigation requests deterministically, and let the LLM route
unusual wording only through a tool constrained to active resource IDs. The backend
validates the selected ID and returns structured source metadata to the client.

**Alternatives considered:** Live scraping and page-specific hardcoded routes. Scraping
is deferred until a source needs inline live data; hardcoded routes do not scale.

**Trade-offs:** The directory can guide students to authoritative pages but does not
claim to read their current contents. Links require periodic human verification.

**Resume/interview angle:** Added a governed, database-driven resource layer that
expands coverage without relaxing RAG grounding or coupling the client to external URLs.

## 2026-09-30 — Link-only live dining menu guidance

**Context:** MyDiningHub exposes Schulze's current menu through an undocumented public
GraphQL endpoint, but its published terms do not clearly authorize Hawkbot to call,
cache, and republish that data. Rendering and scraping the dining page would still
depend on the same backend while adding latency and fragility.

**Decision:** Route recognized Schulze menu questions deterministically to the official
ULM Dining page. If unusual wording reaches the grounded AI stage, the model may invoke
a menu-link tool, but the backend owns and returns the fixed URL. Hawkbot does not
fetch, scrape, cache, summarize, or ingest live menu data. Dining-hours questions
remain owned by the existing structured-hours system.

**Alternatives considered:** Call the GraphQL endpoint directly (fast and structured,
but undocumented and not clearly authorized); render and scrape the webpage (slower,
more fragile, and does not avoid the underlying endpoint or terms issue).

**Trade-offs:** Students leave Hawkbot to inspect the menu and do not receive an inline
answer. In exchange, the feature has no live-menu data dependency, operational cost,
or stale-menu risk, and can later be upgraded if ULM Dining authorizes an integration.

**Resume/interview angle:** Demonstrates a product decision that balanced user
experience against platform terms, reliability, and maintenance, then encoded the
boundary as deterministic routing rather than leaving it to probabilistic RAG.

## 2026-09-16 — Structured campus hours before general RAG

**Context:** Facility schedules are date-sensitive, include holidays and semester
periods, and change more often than general campus knowledge. Embedding schedule text
would make precedence difficult to guarantee and would spend model calls on answers
that can be computed exactly.

**Decision:** Store one normalized current schedule per facility and resolve recognized
hours questions deterministically before the existing RAG path. Exact-date exceptions
override special periods, which override regular weekly hours. One configured owner
uploads a PDF or image, OpenAI extracts it once, and the owner reviews and validates
the structured result before atomic publication. The uploaded document stays only in
memory and publication replaces the previous schedule instead of retaining history.
The campus timezone is fixed to `America/Chicago`. Only anonymous daily counters are
stored for hours routing; question text and user identity are not logged.

**Alternatives considered:** Put schedule documents directly into RAG (simpler, but
unable to guarantee holiday precedence or reliable open-now calculations); store
drafts, source files, and publication history (more auditable, but unnecessary for a
single-owner workflow); allow community uploads and role-based review (more flexible,
but outside the current product need).

**Trade-offs:** There is no built-in rollback or document archive, so the owner must
re-upload and publish a prior schedule to restore it. Extraction still incurs one
OpenAI request per upload, and adding another campus timezone would require a product
change rather than facility-level configuration.

**Resume/interview angle:** Built a hybrid retrieval architecture that routes
date-sensitive questions to deterministic structured data while preserving RAG for
uncertain questions, reducing avoidable embedding and LLM calls and making schedule
precedence testable.

## 2026-08-13 — PWA conversion: installable shell, not offline-first

**Context:** Hawkbot is a bookmark-and-forget web app for students — no install
prompt, no home-screen icon, full reload on every cold visit. It's also
fundamentally a live, auth-gated app (feed, votes, chat all require a network
round trip), so a naive "make it a PWA" pass could easily over-invest in offline
support that doesn't fit how the app actually works.

**Decision:** Used `vite-plugin-pwa` with the `generateSW` (Workbox-generated)
strategy, scoped deliberately narrow: installable, fast cold load, and only a
shell fallback offline. Three caching strategies are chosen per resource type
rather than one blanket rule — hashed JS/CSS/icons via the default precache
(functionally cache-first and revision-invalidated on each deploy); HTML
navigations via a versioned `NetworkFirst` runtime rule with one cached fallback;
and `/api/*` via an explicit `NetworkOnly` rule (matched by pathname so it holds
across the cross-origin Render backend) since feed/vote/chat data must never be
served stale. Vercel explicitly revalidates `index.html`, `sw.js`, and the web
manifest while hashed assets remain immutable. Update
handling uses `registerType: 'autoUpdate'` plus a `virtual:pwa-register/react`
hook that surfaces a manual refresh prompt, since silently-installed updates
don't apply until the user revisits anyway. Install prompting is split by
platform: `beforeinstallprompt` capture for Android/Chrome, manual "Share →
Add to Home Screen" instructions for iOS Safari, which never fires that event.

**Alternatives considered:** Full offline-first (service-worker-cached feed/
posts data, background sync for votes) — rejected as solving a problem this
app doesn't have; the value proposition is a live community forum, not an
offline reader. Relying on `vite-plugin-pwa`'s default `navigateFallback`
(precache-backed shell, refreshed only on new SW installs) was also rejected.
An initial custom stale-while-revalidate HTML rule was shipped, but production
showed an old shell could reference hashed JS/CSS removed by a newer Vercel
deployment. Vercel then rewrote those missing asset requests to HTML, producing
strict MIME errors and a white screen until refresh. Network-first navigation
removes that stale-shell deployment race.

**Trade-offs:** Navigation may wait up to five seconds for the network before
using the cached shell, prioritizing deploy consistency over instant stale HTML.
There is no dedicated offline experience, and live authenticated data still
requires the network. iOS install relies on user-agent sniffing rather than a
platform API, so it remains best-effort.

**Resume/interview angle:** Shipped a PWA conversion with per-resource-type
caching strategy selection (not a single default), and caught a real
default-config bug where the plugin's own navigation fallback would have
silently overridden the intended caching rule — found via reading the compiled
service worker output, not just trusting the build succeeded. Good talking
point for "how do you verify a caching layer actually does what you think it
does" — the answer here was inspecting the generated `sw.js` and driving a real
production build in headless Chrome (Playwright) to confirm requests were
actually being served from the service worker, not just configured to be.

## 2026-03 — Vote-gated knowledge approval before RAG ingestion

**Context:** A chatbot answering campus questions needs a knowledge source, but letting
the LLM freely answer from its own training data risks confidently wrong answers about
ULM-specific policies, hours, deadlines, etc. — things that change and that the model
has no ground truth on.

**Decision:** The chatbot only ever answers from `approved_knowledge`, a table it can't
write to directly. Content gets there only after a student-submitted answer on the
forum crosses `VOTE_APPROVAL_THRESHOLD` community upvotes, at which point it's cleaned
by an LLM pass (`cleanContent`) and embedded. The chatbot's own RAG flow
(`chatbot.services.js`) is read-only against this table, with an explicit similarity
threshold and an honest fallback message when nothing matches.

**Alternatives considered:** Letting the LLM answer freely with campus context stuffed
into the prompt (faster to ship, no human-in-the-loop bottleneck, but no correctness
guarantee); admin-only manual curation of the knowledge base (more control, doesn't
scale, defeats the point of a community-sourced forum).

**Trade-offs:** Knowledge base grows only as fast as the community answers and votes —
slow bootstrapping, and popular-but-wrong answers could theoretically clear the
threshold. Coverage is inherently incomplete (by design, this is a "grows over time"
system, not a "knows everything on day one" system).

**Resume/interview angle:** Designed a human-in-the-loop RAG pipeline that trades
completeness for correctness — a deliberate response to LLM hallucination risk in a
domain where wrong answers (financial aid deadlines, housing policy, etc.) have real
consequences for users. Good talking point for "how do you keep an LLM from making
things up" style interview questions.

## 2026-09-21 — Keyset pagination for the Hawkwall feed

**Context:** Hawkwall loaded every top-level post in a single database query and
rendered the entire result immediately. Feed cost therefore grew with the complete
history, even though users initially see only the newest few posts.

**Decision:** Fetch 10 posts at a time and automatically fetch the next batch as a
viewport sentinel approaches. Pages use the compound `(created_at, id)` cursor so
ordering remains deterministic when timestamps tie. A matching partial index covers
only pending, non-answer feed rows in descending cursor order.

**Alternatives considered:** Offset pagination was simpler but can skip or duplicate
posts as new content is inserted and gets progressively more expensive on deep pages.
A manual “Load more” button uses the same backend design but adds friction to browsing;
it remains as the retry path if an automatic request fails.

**Trade-offs:** Infinite scroll does not expose numbered pages or direct page links,
and the client retains already-loaded posts for the duration of the session. Keyset
pagination also cannot jump to an arbitrary page, which is not needed for this feed.

**Resume/interview angle:** Replaced an unbounded feed query with indexed keyset
pagination and incremental rendering, keeping query cost stable as post history grows
while preserving deterministic ordering during concurrent inserts.

## 2026-09-25 — Session cache for Hawkwall route navigation

**Context:** React Router unmounted Hawkwall when a user opened chat, discarding the
loaded feed, pagination cursor, expanded replies, and scroll position. Returning to
Hawkwall therefore repeated the first-page request even when the data had just loaded.

**Decision:** Keep Hawkwall feed state in a user-scoped provider above the routes. A
return within 120 seconds restores the retained feed and scroll position without a
request. After 120 seconds, retained posts remain visible while the newest page is
refetched in the background and pagination restarts from that fresh page.

**Alternatives considered:** Keeping both complete route trees mounted would preserve
local component state but retain hidden DOM and complicate scroll and modal behavior.
Reconciling every cached post individually would retain deep pages during refresh but
adds API and cache complexity that the current feed does not need.

**Trade-offs:** A stale refresh intentionally discards previously loaded deeper pages
and cached replies. The cache lasts only for the active browser session and is reset
when the authenticated user changes, avoiding cross-account feed state.

**Resume/interview angle:** Added a stale-while-revalidate route cache that removes
redundant navigation fetches while retaining a bounded freshness policy and isolating
personalized state by authenticated user.

## 2026-09-25 — Hawkbot prompt as the Hawkwall entry point

**Context:** Hawkwall is the authenticated landing page to encourage community
participation, but presenting posts first can imply that public posting is the primary
way to get an answer even though Hawkbot should be the first path.

**Decision:** Place a compact Hawkbot prompt above the feed using the same personalized
greetings, logo, validation, and daily usage rules as the full chat. Submitting moves
the question through transient router state to the dedicated chat page, where it is
cleared from navigation state and sent exactly once. The feed does not run a parallel
chat implementation or make the chat API request itself.

**Alternatives considered:** Making chat the landing page would weaken the deliberate
community-engagement role of Hawkwall. Embedding a complete conversation in the feed
would duplicate chat state and create competing page responsibilities. Putting the
question in the URL would make private text visible in history and shared links.

**Trade-offs:** Navigation is required before the answer begins, and transient router
state does not survive a browser crash between submission and chat initialization.
In exchange, chat ownership, rate limiting, error handling, and fallback-to-Hawkwall
behavior remain centralized on the full chat page.

**Resume/interview angle:** Designed a cross-feature onboarding funnel that preserves
community engagement while clarifying the AI-first answer path, with a single-owner
submission flow that avoids duplicate requests and URL exposure of user questions.

## 2026-09-28 — GitHub-scheduled knowledge verification

**Context:** Knowledge review needs to expire unanswered verification posts, retry a
first attempt once, and publish newly due reviews. Hawkbot's Render web service may
sleep or restart, so an in-process timer cannot guarantee that a daily run occurs.

**Decision:** Expose the review workflow as a one-shot backend command and invoke it
daily with GitHub Actions using an encrypted `DATABASE_URL` repository secret. Each
run handles expired attempts first and then publishes newly due facts; both stages
share the database-enforced open-review rule and five-post daily cap.

**Alternatives considered:** A `setInterval` inside Express is simpler but misses runs
while the service sleeps and can duplicate work if multiple instances start. A Render
Cron Job provides managed run history but has a monthly minimum charge. Triggering the
workflow from user requests would make correctness depend on traffic and add latency.

**Trade-offs:** The repository must have a correctly configured `DATABASE_URL` secret,
and GitHub may delay scheduled workflows during periods of high load. In exchange,
the free-tier web service uses no extra Render compute, review timing is independent
of web traffic, and transactions plus advisory locks make overlapping runs safe.

**Resume/interview angle:** Designed a durable scheduled workflow for an ephemeral web
runtime, separating background work from request handling and protecting it with
transactional idempotency and a global publication cap.

## 2026-09-29 — Thresholded outdated reports for RAG facts

**Context:** Students need a way to flag an answer that relies on knowledge that may
no longer be accurate, but a single report must not let one account remove or disable
community-approved knowledge.

**Decision:** Show an Outdated action only on RAG answers with cited knowledge IDs.
Each authenticated user can create one open report per fact. Once open reports reach
the same threshold as community approval, the fact becomes due for early verification
but remains active until the community verification post reaches a verdict.

**Alternatives considered:** Immediately hiding a fact after one report enables abuse.
Free-text reports require manual interpretation and cannot reliably identify the fact
that grounded an answer. A separate report threshold would add another configuration
whose meaning overlaps the existing community-consensus threshold.

**Trade-offs:** If one answer uses multiple atomic facts, the report applies to each
one because the interface cannot know which clause concerned the user. Reports also
wait for the daily review job rather than bypassing its five-post publication cap.

**Resume/interview angle:** Added traceable, abuse-resistant user feedback to a RAG
system by connecting generated answers back to atomic source IDs and routing consensus
through a transactional human-in-the-loop revalidation workflow.

## 2026-10-01 — Community correction questions replace stale facts

**Context:** A rejected verification correctly removes stale knowledge from RAG, but
without a replacement path the community has no clear way to supply updated facts and
new approvals cannot be associated with the specific knowledge they supersede.

**Decision:** When HawkNah reaches the verification threshold, Hawkbot creates one
normal HawkWall question linked to the stale fact. Students answer and vote through the
existing workflow. Approval still curates and embeds atomic facts; inside that same
storage transaction, the first new atomic fact becomes the canonical replacement, the
old fact becomes `replaced`, and the correction question becomes `resolved`.

**Alternatives considered:** Free-form admin editing would bypass community approval
and require careful embedding regeneration. Treating the correction as unrelated new
knowledge would leave no lineage and could preserve conflicting records. A separate
correction UI would duplicate the established question, answer, and voting workflow.

**Trade-offs:** A correction answer that produces multiple atomic facts uses the first
as the direct successor because the stale record has one `superseded_by_id`; all other
curated facts are still stored as active knowledge. Correction wording is deterministic
and truncated to the standard 250-character post limit, avoiding another AI call.

**Resume/interview angle:** Completed a community-governed knowledge lifecycle with
transactional lineage from stale fact to correction question to embedded replacement,
reusing existing moderation primitives while preventing partial replacement state.

## 2026-10-07 — Official provenance for administrator-seeded knowledge

**Context:** The original seed file contained 83 unsourced strings, including duplicated
facts, semester-specific facility hours, outdated locations, and an incorrect housing
description. Because those rows had no HawkWall post, source rendering could produce an
invalid `/sources/hawkwall/0` link and users could not inspect where a claim came from.

**Decision:** Replace the legacy seed set with a reviewed catalog of stable facts backed
by official ULM or ULM-operated pages. Store an official source URL and title on each
administrator-seeded fact, return those sources alongside community citations, and mark
the old unsourced rows as `replaced`. Keep facility schedules and dining meal times out
of RAG because the structured hours and dining-link paths are their authoritative owners.

**Alternatives considered:** Preserving every legacy row would retain broad coverage but
also retain known stale and unverifiable claims. Creating fake HawkWall posts would make
links work while misrepresenting provenance. Live scraping every source would improve
freshness but introduces availability, parsing, policy, and operating-cost concerns that
are not justified for this small curated catalog.

**Trade-offs:** The retained catalog is intentionally smaller, and migration-created rows
initially rely on full-text retrieval until embeddings are generated by a later seed or
backfill run. In exchange, every restored claim is inspectable, time-sensitive schedules
have one owner, and the retired rows remain recoverable for audit purposes.

**Resume/interview angle:** Migrated an unsourced RAG seed corpus into a provenance-aware,
auditable knowledge catalog, separating stable institutional facts from structured live
data and preventing fabricated or invalid citations.
