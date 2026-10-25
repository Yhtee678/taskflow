# Development Plan

Keep each phase independently testable. Do not start the next phase until the current phase has been reviewed.

## Phase 0 — Foundation
- Initialize React + TypeScript + Vite (strict mode).
- Add Tailwind CSS and shadcn/ui using compatible versions.
- Add Supabase JS client configuration with placeholder environment variables only.
- Configure lint, typecheck, test, and build scripts.
- Create a minimal landing page and update README with verified setup steps.
- Add `.gitignore` and `.env.example`; no secrets.
- **Acceptance:** local dev server starts; lint/typecheck/tests/build pass; no database changes or authentication implementation.

## Phase 1 — Auth and database
- Create a small relational schema for approved members, projects, sections, tasks, and steps.
- Implement Google sign-in and RLS that rejects nonmembers.
- Version migrations and test access boundaries.
- **Acceptance:** approved account can read its group data; unapproved/anonymous account cannot.

## Phase 2 — Core planner
- Project, section, task, and step CRUD; task assignment, due dates, statuses.
- Use existing Figma design as reference without copying legacy backend.
- **Acceptance:** a small group can manage one real assignment end to end.

## Phase 3 — Views and polish
- My Tasks, All Tasks, Overview; error and empty states; responsive layouts.
- **Acceptance:** members can find their assigned work and deadlines reliably.

## Optional later
- Availability/calendar, realtime improvements, reminders; prioritize based on actual usage.

## Phase 0 agent task
Initialize only Phase 0 in this repository. First inspect the repo and these documents; propose a concise implementation plan. Do not implement Phase 1 features. Use current compatible package versions, document exact commands, run checks, and report results. Do not push, merge, or deploy without approval.
