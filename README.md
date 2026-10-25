# TaskFlow

TaskFlow is a lightweight, collaborative project and task management web application. It gives each person a clear view of their own responsibilities while making work across a shared project transparent. Its workflow combines structured task lists, editable task guidance and checklists, project membership, deadline tracking, and team availability planning.

> **Project status:** Phase 1 frontend preview implemented with fictional mock data. Authentication, persistence, and backend authorization are not implemented. Figma fidelity awaits visual review.

## Core workflow

1. Sign in with Google using Supabase Auth. A persisted session normally avoids repeated sign-ins.
2. Land on **My Tasks**, showing tasks assigned to you across projects you belong to.
3. Open **My Projects** and select a project.
4. In the selected project, review **Overview**, **All Tasks**, **Members**, **Deadline Calendar**, and **Availability**.
5. Create or edit sections and tasks; assign tasks to project members; maintain steps, guidance, and resource links.
6. Check team deadlines and record time ranges when you are available to meet or collaborate.

**Transparency model:** Members of a project can view and collaboratively edit all tasks in that project, regardless of assignee. The assignee indicates responsibility, not exclusive editing permission. People outside the project must not access its data.

## Technology

| Layer              | Choice                                                       |
| ------------------ | ------------------------------------------------------------ |
| Web application    | React + TypeScript + Vite                                    |
| Routing            | React Router                                                 |
| UI                 | Tailwind CSS + shadcn/ui                                     |
| Identity           | Supabase Auth, Google OAuth                                  |
| Data               | Supabase PostgreSQL                                          |
| Authorization      | PostgreSQL Row Level Security (RLS)                          |
| Data access        | `@supabase/supabase-js` directly from the browser            |
| Validation         | TypeScript types and Zod where useful                        |
| Testing            | Vitest + React Testing Library; authorization/database tests |
| Deployment (later) | Vercel or Netlify + hosted Supabase                          |

No dedicated Node/Express/Nest backend, Next.js, Prisma, Drizzle, Redux, Docker, Google Apps Script, or Google Sheets is planned for v1. Supabase is the backend service; the browser must never contain a service-role key.

## Design reference

**Source of truth:** [TaskFlow Figma](https://www.figma.com/design/oOU4WPTBqP6EdO5YIiGfsx)

The file contains nine screens: My Tasks, Task Details, Overview, All Tasks, Availability, Sign in, My Projects, Project Members, and Deadline Calendar. The existing restrained, compact design language is intentional. Implement it faithfully; do not replace it with a generic dashboard. See `AGENTS.md` for UI guardrails.

## Documentation map

- [`docs/requirements.md`](docs/requirements.md) — user journeys, permissions, functional requirements, acceptance criteria, and non-goals.
- [`docs/architecture.md`](docs/architecture.md) — components, data model, RLS, queries, validation, and security.
- [`docs/development-plan.md`](docs/development-plan.md) — ordered implementation phases and quality gates.
- [`AGENTS.md`](AGENTS.md) — mandatory instructions for coding agents and contributors.

When documents differ, resolve the discrepancy before implementation. Never infer product behavior solely from a mockup.

## Getting started

Use Node.js 22.12+ and npm. No Supabase account or environment variables are required for the Phase 1 preview.

```sh
npm install
npm run dev
```

Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `format`, and `format:check`. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

See [Phase 1 notes](docs/phase-1.md) for routes, structure, scope and visual review limitations. The following Supabase checklist is future Phase 2 work.

### Supabase setup checklist

1. Create a Supabase project and record its project URL and browser publishable/anon key.
2. Enable Google OAuth and configure authorized redirect URIs for local development and the eventual deployed domain.
3. Apply version-controlled SQL migrations for schema, constraints, indexes, policies, and narrowly scoped database functions.
4. Verify policies using at least two distinct signed-in test users and two projects; test both authorized and unauthorized operations.
5. Configure development URLs and redirect allowlists. Do not enable production deployment until approved.

## Version 1 boundaries

**Included:** authentication, project-based membership, project selection, cross-project My Tasks, project overview, sections/tasks, assignees, steps, guidance, reference URLs, member management, deadline calendar, and shared time-slot availability.

**Deferred:** in-app notifications, email reminders, push notifications, realtime subscriptions, Kanban view, external calendar sync, file uploads, complex permissions, and advanced analytics.

A signed-in account does not automatically belong to any project. Project membership is explicitly granted by a project leader. A newly created project automatically grants its creator the leader role.

## Contribution approach

Work in small, reviewable changes. Every feature should include appropriate tests and, for database work, migration and RLS coverage. Preserve meaningful Git history. Do not fabricate contributions or claim unimplemented features are complete. No automated deployment or unsolicited commits without explicit approval.

## Current status

- [x] Requirements and architecture baseline drafted
- [x] Nine Figma screen references available
- [x] React/Vite application scaffolded (mock frontend preview)
- [ ] Supabase project and database configured
- [ ] Authentication and project membership implemented
- [ ] Task management implemented
- [ ] Calendars and availability implemented
- [ ] Acceptance and security tests passing
