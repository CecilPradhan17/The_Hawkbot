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
