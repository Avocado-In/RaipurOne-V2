---
name: smart-grievance-management-system-development
description: "Use when building, extending, or reviewing the Smart Grievance Management System. Guides architecture-first implementation, phase-by-phase delivery, and production-quality decisions for the web app, backend, AI services, database, Telegram bot, and Flutter app."
argument-hint: "Describe the feature, phase, or issue to implement"
user-invocable: true
---

# Smart Grievance Management System Development

## When to Use
- Start or continue development for the Smart Grievance Management System.
- Implement a new feature, fix an issue, or review architecture decisions.
- Work through a phase in the project lifecycle.
- Need a production-ready, maintainable engineering approach.

## Core Mission
You are the permanent senior software architect and lead engineer for this project. Deliver work as if it will be maintained by another team for years.

## First Principles
Before writing code, always read:
- [phases.md](../../../../phases.md)
- [plan.md](../../../../plan.md)
- [stack.md](../../../../stack.md)

These files are the single source of truth. Never ignore them.

## Operating Rules
- Implement only the current phase.
- Never build future phases.
- Never skip architecture.
- Never generate placeholder code.
- Never create fake APIs.
- Never use mocked business logic unless explicitly allowed in [phases.md](../../../../phases.md).
- Keep every feature production-ready.

## Engineering Principles
Follow these principles consistently:
- Clean Architecture
- SOLID
- DRY
- KISS
- Separation of Concerns
- Feature-first organization
- Modular design
- Reusable components

Every module should have a single responsibility.

## Before Every Response
Determine these before implementation:
1. Current phase
2. Goal of this phase
3. Files affected
4. Dependencies
5. Future compatibility

Then begin implementation.

## Architecture and Delivery Workflow
1. Review project guidance
   - Read [phases.md](../../../../phases.md), [plan.md](../../../../plan.md), and [stack.md](../../../../stack.md).
   - Confirm the current phase and its boundaries.

2. Understand the scope
   - Identify the user story, feature, or fix.
   - Determine the impacted modules, services, and integrations.
   - Check whether the work is UI-only, backend-only, AI-related, data-related, or cross-cutting.

3. Design before implementation
   - Choose the right architecture pattern for the feature.
   - Keep business logic in services, not in route handlers.
   - Use clear module boundaries and reusable abstractions.
   - Favor maintainability over shortcuts.

4. Implement in the current phase only
   - Respect the phase-specific scope.
   - Do not introduce future-phase dependencies.
   - Keep the implementation deployable and testable.

5. Validate thoroughly
   - Confirm code compiles and imports are valid.
   - Remove placeholders, TODOs, and incomplete logic.
   - Verify that the feature is integrated properly.
   - Confirm documentation is updated where needed.

6. Report clearly
   - Summarize what was implemented.
   - Explain integration points.
   - Recommend the next step.

## Product and UX Expectations
The UI should be:
- Minimal
- Elegant
- Modern
- Professional
- Premium
- Responsive
- Accessible

Use whitespace generously and avoid unnecessary color. The visual language should feel like Linear, Notion, Apple, or Vercel.

## Technical Stack Expectations
Follow the stack in [stack.md](../../../../stack.md):
- Web: Next.js, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Hook Form, Zod, Framer Motion, Lucide Icons, Recharts
- Mobile: Flutter, Riverpod, Go Router, Dio, Freezed, Flutter Hooks, Material 3
- Backend: Python, FastAPI, Pydantic v2, SQLAlchemy, Supabase, JWT authentication, Redis optionally, background tasks where appropriate
- AI: Transformers, XLM-RoBERTa, Sentence Transformers, PyTorch, ONNX, OpenCV, Pillow
- Database: Supabase PostgreSQL with RLS, storage buckets, policies, indexes, triggers, migrations
- Telegram: python-telegram-bot with webhook-based architecture

## Backend Guidance
- Use FastAPI.
- Prefer proper routers.
- Use dependency injection.
- Keep logic in services and repositories.
- Use schemas and models clearly.
- Handle validation, logging, and errors properly.
- Protect APIs and uploads.
- Never place business logic inside API routes.

## AI Guidance
- Use Transformers.
- Keep AI modular and replaceable.
- Keep preprocessing independent from business logic.
- Expose AI through services.
- Never let AI make irreversible administrative decisions without human approval.

## Database Guidance
- Use Supabase.
- Normalize tables.
- Add proper indexes and foreign keys.
- Use UUIDs everywhere.
- Avoid SERIAL IDs.
- Implement policies, triggers, audit logs, and soft deletes where appropriate.

## Flutter Guidance
- Reuse backend APIs.
- Maintain consistent design language.
- Do not duplicate business logic.
- Use Riverpod and clean architecture.

## Code Organization Guidance
- Keep folders organized by feature.
- Group related code together.
- Use descriptive names.
- Avoid abbreviations and magic values.
- Avoid deeply nested logic.

## Documentation Expectations
Whenever creating or changing a feature:
- Update documentation.
- Explain architecture.
- Document APIs.
- Document environment variables.
- Document setup.

## Completion Criteria
A task is complete only if all of the following are true:
- Code compiles
- No placeholders remain
- No TODOs remain
- No broken imports remain
- The implementation is modular
- The implementation is documented
- The result is production-ready

## Guardrails by Phase
- Phase 1: Focus on the website UI and experience only.
- Phase 2: Build backend, AI pipeline, Telegram bot, authentication, and APIs.
- Phase 3: Replace temporary storage with Supabase and implement the full data model.
- Phase 4: Build the Flutter app and integrate it with the backend.

## Anti-Patterns to Avoid
- Building future phases too early
- Hardcoding business logic in UI or routes
- Creating fake services or mock APIs without approval
- Skipping validation or documentation
- Shipping features that are not modular or maintainable
