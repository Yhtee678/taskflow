# TaskFlow

TaskFlow is a lightweight assignment planner for a small USM student group. It helps members organize assignments, divide work, track progress, and see upcoming deadlines in one place.

> Status: Planning / Phase 0. This repository is a fresh implementation. Features listed below are planned, not yet available.

## Scope

- One shared group workspace with a fixed set of approved members (not hard-coded to five).
- Multiple assignments/projects in the same workspace.
- Sections, tasks, and checkable task steps.
- Task assignment, due dates, status, and basic progress views.
- My Tasks, All Tasks, and Overview.

**Out of scope for the MVP:** public registration, workspace creation/invitations, multi-workspace SaaS, billing, complex role hierarchies, and automated reminders. Availability/calendar and realtime enhancements may be considered after the core planner works.

## Planned stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase Auth (Google sign-in), PostgreSQL, and Row Level Security (RLS)
- Vitest for focused tests

No Google Apps Script or Google Sheets backend. No Next.js, Express, Prisma, or Drizzle for this version.

## Local setup

Phase 0 has not yet initialized the application. Once it is scaffolded, this section will contain verified installation, environment configuration, and run commands. Do not invent commands or claim that the app is running before verification.

Never commit Supabase secrets. Only browser-safe public/publishable keys may be used in the frontend; authorization must be enforced in the database.

## Documentation

- [Requirements](docs/requirements.md)
- [Development plan](docs/development-plan.md)
- [Agent instructions](AGENTS.md)

## Project history

An earlier prototype used Google Apps Script and Google Sheets. It was discontinued because of latency, development friction, and maintainability concerns. The new implementation intentionally starts with a simpler React + Supabase architecture.
