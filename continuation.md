# RaipurOne Phase 1â€“3 Completion Plan

## Scope

Finish the existing website, FastAPI backend, Telegram intake, and Supabase persistence through Phase 3. AI model training and inference are intentionally excluded. The backend will retain a small rule-based development provider and expose a stable adapter interface for the project's future RoBERTa implementation.

## Current State

- The React dashboard builds, but it uses several legacy API paths and offline fallbacks.
- The FastAPI service has complaint, notification, authentication, AI, and Telegram routes.
- Telegram uses a hand-written HTTP webhook handler; `python-telegram-bot` is installed but unused.
- Telegram environment variables are missing, so webhook registration is skipped.
- Supabase credentials are present, but repository errors silently fall back to memory.
- The SQL draft has incomplete Phase 3 entities and permissive RLS policies.

## Implementation Order

1. Stabilize configuration, API contracts, error handling, and the repository boundary.
2. Keep AI as a provider boundary: rule-based fallback now, RoBERTa adapter later.
3. Replace the previous webhook/polling split with one standalone polling worker that validates configuration, prevents duplicate local instances, handles text/photo/location messages, and persists complaints strictly to Supabase.
4. Replace the draft Supabase schema with authenticated profiles, complaints, workers, departments, images, trust scores, ratings, notifications, assignment history, audit logs, Telegram identities, constraints, indexes, triggers, Storage, and role-based RLS.
5. Connect repositories and notifications to Supabase without silent production fallback.
6. Align the existing React dashboard with the API, authentication state, complaint intake, error handling, and explicit development-only offline mode.
7. Verify backend tests, frontend tests/build, migrations, RLS, Storage policies, and end-to-end complaint flow.

## Telegram Acceptance Criteria

- `/start` and `/help` return replies.
- Text complaints create exactly one complaint and notification.
- Photo captions and location data are accepted.
- Telegram secret-token validation is enforced in webhook mode.
- Replayed Telegram updates do not create duplicate complaints.
- Webhook registration is skipped only when configuration is intentionally absent and is reported by health/status diagnostics.
- Polling mode works locally without a public HTTPS endpoint.

## AI Acceptance Criteria

- Complaint and Telegram routes depend on an `AIProvider` interface rather than model code.
- The current rule-based provider remains deterministic for local development and tests.
- A future RoBERTa provider can implement classification, priority, and worker recommendation without changing API routes or persistence.
- AI output remains advisory; administrators approve assignments.

## Assumptions

- The current React dashboard remains in place; migrating it to Next.js is out of scope.
- Supabase Auth is the identity source; the backend alone may use the service-role key.
- In-memory storage is test/development-only and never a silent production fallback.
- Phase 4 Flutter work starts only after the Phase 1â€“3 acceptance tests pass.

