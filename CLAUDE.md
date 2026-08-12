# Hawkbot

A chatbot + community Q&A forum for University of Louisiana Monroe (ULM) students. Students post questions on a feed, other students answer, answers that clear a vote threshold get pulled into a verified knowledge base, and the chatbot answers future questions using RAG over that knowledge base only — it never generates unverified campus info.

## Stack

- **Backend**: Node (ESM) + Express 5, `backend/src`. Postgres (pgvector) via `pg`, JWT auth (`jsonwebtoken` + `bcrypt`), OpenAI API for embeddings + LLM polishing.
- **Frontend**: React 19 + TypeScript + Vite, `frontend/src`. Tailwind v4, React Router, Framer Motion.
- **Deploy**: frontend on Vercel, backend on Render, DB on Neon (Postgres/pgvector).

## Architecture

**Request flow**: `server.js` boots `app.js` → CORS (allowlist: `localhost:5173` + `FRONTEND_URL`) → `express.json()` → routes mounted at `/api` (`routes/index.js`) → controller → service → `db.js` pool.

Layering is `routes/ -> controllers/ -> services/`, one feature per file pair (e.g. `posts.routes.js` / `posts.controllers.js` / `posts.services.js`). Follow this pattern for new endpoints rather than putting logic in controllers.

**RAG chatbot flow** (`services/chatbot.services.js`):
1. Embed the user's question with `generateQueryEmbedding` (query-type embedding, asymmetric search).
2. Pull top 3 matches from `approved_knowledge` by cosine similarity (pgvector `<=>`).
3. If best match < `SIMILARITY_THRESHOLD` (0.50) → return an honest fallback, no LLM call.
4. Otherwise pass the matched rows to `polishResponse` (`llm.services.js`) to synthesize the final answer.

**Approval pipeline** (`services/approval.services.js`), triggered from `vote.services.js` once an answer crosses `VOTE_APPROVAL_THRESHOLD`:
question + answer → `cleanContent` (LLM) → `generateEmbedding` → insert into `approved_knowledge`. This is fire-and-forget — errors are logged, not surfaced to the voter.

**Migrations**: plain numbered SQL files in `backend/migrations/`, applied manually/sequentially (no migration runner). When changing schema, add the next-numbered file rather than editing an old one.

**Frontend**: `src/api/*.ts` wraps backend calls through `request.ts` (has cold-start retry/timeout logic for Render's sleep behavior — see `ServerWakeModal`/`ServerWakeContext`). `context/AuthContext.tsx` holds auth state; `routes/ProtectedRoute.tsx` gates authed pages. Pages live in `src/pages/`.

## Commands

- Backend dev: `cd backend && npm run dev` (nodemon, port 4005)
- Frontend dev: `cd frontend && npm run dev` (Vite, port 5173)
- Frontend build/typecheck: `cd frontend && npm run build` (runs `tsc -b` then `vite build`)
- Frontend lint: `cd frontend && npm run lint`
- Backend has no test suite and no lint script currently configured.

## Environment variables (backend/.env, gitignored)

`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `VOTE_APPROVAL_THRESHOLD`, `OPENAI_API_KEY`, `FRONTEND_URL`, `NODE_ENV`. Never print `.env` contents or commit secrets.

## Deployment reality check

Frontend (Vercel), backend (Render), and DB (Neon) all exist as real deployed environments, not just local dev. There are no active users right now, but the app has had real users before and their data may still be in the Neon DB — treat migrations, seed scripts, and destructive queries against `DATABASE_URL` as if they could hit real data. Confirm before running anything against production, before schema changes, and before deploying/pushing.

## How we work together

Cecil built this solo ~5 months ago as a newer engineer, so expect some rough edges/unconventional patterns alongside genuinely solid parts (the RAG/approval pipeline is intentional and well-reasoned — don't assume everything is accidental).

Two work modes:
- **Architect/brainstorm mode** — for new architectural features or anything nontrivial: explain what you're about to build, why, how it works, and how it connects to the rest of the codebase *before* writing code. Treat it as a design discussion, not a green light to implement.
- **Build mode** — for trivial changes (UI tweaks, small fixes, styling, copy): go ahead and edit freely. Still nothing risky — no migrations, no prod-affecting commands, no git push/deploy without asking.

Code quality: if you spot odd patterns, tech debt, or potential issues while working on something else, flag them — don't fix unprompted. Fix only what's in scope for the current task.
