# Campus hours operations

Hawkbot answers recognized facility-hours questions from structured Postgres data
before falling back to the existing RAG pipeline. This document covers setup and the
single-owner publishing workflow.

## One-time setup

1. Apply `backend/migrations/014_create_hours_system.sql` to the intended database,
   after migrations 001–013. Migrations are manual; verify the target database before
   running the file.
2. Set `HOURS_ADMIN_EMAIL` in the backend environment to the email address of the one
   Hawkbot account allowed to manage schedules. Matching is case-insensitive.
3. Ensure `OPENAI_API_KEY` is configured. It is used once per uploaded document for
   extraction; answering published-hours questions does not call OpenAI.
4. Restart the backend after changing environment variables.

The admin interface is at `/hours/admin`. The user must be signed in with the account
whose email matches `HOURS_ADMIN_EMAIL`.

## Publishing a schedule

1. Create or select a facility. Add the common names students use as aliases, such as
   `AC` for `Activity Center`.
2. Upload a PDF, PNG, JPEG, or WebP schedule. Files are limited to 10 MB, held in
   process memory during extraction, and never stored in the database or filesystem.
3. Compare the original document with every extracted field. Review regular weekly
   hours, special date ranges, individual date exceptions, overnight closing flags,
   coverage dates, and extraction warnings.
4. Use the date preview to check representative regular, special-period, holiday, and
   overnight dates.
5. Validate, then publish. Publication atomically replaces that facility's existing
   schedule. There are no drafts, source-document storage, or publication history.

## Resolution rules

For a requested date, Hawkbot applies rules in this order:

1. Exact-date exception, such as a holiday closure.
2. Matching special period, such as finals or winter break.
3. Regular weekday schedule.
4. Unverified response when the date is outside schedule coverage or no verified rule
   is available.

All date and open-now calculations use `America/Chicago`. A closing time marked
`next day` belongs to an interval that crosses midnight. Multiple intervals allow a
facility to close and reopen on the same day.

If the question cannot be confidently mapped to one facility and a supported hours
intent, Hawkbot leaves it to the existing RAG flow instead of guessing.

## Replacement and recovery

Publishing deletes the current schedule and inserts the replacement in one database
transaction. If insertion fails, the transaction rolls back and the previous schedule
remains current. After a successful replacement, Hawkbot has no stored copy of the old
schedule; recovery requires uploading or manually reconstructing and publishing it
again.

## Privacy and metrics

The hours system stores aggregate daily counters for structured answers, unverified
answers, fallbacks, and avoided AI calls. It does not store the user's question text or
user ID in hours metrics.

## Verification

- Backend: `cd backend && npm test`
- Frontend production build: `cd frontend && npm run build`
- Hours frontend lint: `cd frontend && npx eslint src/pages/HoursAdmin.tsx src/api/hours.api.ts src/App.tsx`

The test suite does not require a live database or OpenAI request; those boundaries are
mocked. Do not use the production `DATABASE_URL` for manual testing.
