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

## 2026-08-13 — PWA conversion: installable shell, not offline-first

**Context:** Hawkbot is a bookmark-and-forget web app for students — no install
prompt, no home-screen icon, full reload on every cold visit. It's also
fundamentally a live, auth-gated app (feed, votes, chat all require a network
round trip), so a naive "make it a PWA" pass could easily over-invest in offline
support that doesn't fit how the app actually works.

**Decision:** Used `vite-plugin-pwa` with the `generateSW` (Workbox-generated)
strategy, scoped deliberately narrow: installable, fast cold load, no offline
mode. Three caching strategies chosen per resource type rather than one
blanket rule — hashed JS/CSS/icons via the default precache (functionally
cache-first, revision-invalidated on each deploy); the HTML app shell via an
explicit `StaleWhileRevalidate` runtime rule so it revalidates on every visit
instead of only on a new service-worker install; and `/api/*` via an explicit
`NetworkOnly` rule (matched by pathname so it holds across the cross-origin
Render backend) since feed/vote/chat data must never be served stale. Update
handling uses `registerType: 'autoUpdate'` plus a `virtual:pwa-register/react`
hook that surfaces a manual refresh prompt, since silently-installed updates
don't apply until the user revisits anyway. Install prompting is split by
platform: `beforeinstallprompt` capture for Android/Chrome, manual "Share →
Add to Home Screen" instructions for iOS Safari, which never fires that event.

**Alternatives considered:** Full offline-first (service-worker-cached feed/
posts data, background sync for votes) — rejected as solving a problem this
app doesn't have; the value proposition is a live community forum, not an
offline reader. Relying on `vite-plugin-pwa`'s default `navigateFallback`
(precache-backed shell, refreshed only on new SW installs) instead of a custom
SWR rule — simpler, but means users could sit on a stale shell for a long time
between deploys; caught during implementation that this default also silently
registers *ahead of* custom runtime rules, which would have made the intended
SWR rule dead code.

**Trade-offs:** No offline fallback screen — a dead network shows the app's
existing error states, not a dedicated "you're offline" UI. iOS install relies
on user-agent sniffing rather than a platform API, so it's inherently
best-effort (breaks if Apple changes the UA string pattern).

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
