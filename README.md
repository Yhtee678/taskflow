# TaskFlow

TaskFlow is a lightweight, collaborative project and task management web application. It gives each person a clear view of their own responsibilities while making work across a shared project transparent. Its workflow combines structured task lists, editable task guidance and checklists, project membership, deadline tracking, and team availability planning.

> **Project status:** Phase 3 real-data integration is implemented locally. Apply the Phase 3 migration before use. Live persistence and authorization remain unverified; see [Phase 3 setup and acceptance](docs/phase-3.md).

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

Use Node.js 22.12+ and npm. Copy `.env.example` to `.env.local`, set your Supabase URL and Publishable Key, and configure Google OAuth redirects as described in [Phase 2 setup and verification](docs/phase-2.md). No secrets belong in Vite variables. Application routes now require sign-in.

```sh
npm install
npm run dev
```

Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `format`, and `format:check`. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

See [Phase 1 notes](docs/phase-1.md) for the UI baseline and [Phase 2 notes](docs/phase-2.md) for auth behavior, the migration, SQL authorization tests and outstanding manual checks. The application does not automatically apply migrations.

### Supabase setup checklist

1. Create a Supabase project and record its project URL and browser Publishable Key.
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

- Phase 2 database and authentication checks succeeded on the disposable project (owner-reported).
- Phase 3 integration is implemented locally across existing planner screens.
- Phase 3 migration application, database tests and live CRUD acceptance remain pending.
- See [Phase 3 notes](docs/phase-3.md) for migration instructions and verification limits.

## Calendar enhancement

See [Calendar setup and manual migration order](docs/calendar-scheduling.md) before using personal Busy events, Suggested Availability, team occupancy and the Overview mini calendar. The additive Calendar migration and its SQL tests have not been executed remotely by the implementation agent.

## Task collaboration

See [Comments and in-app notifications](docs/comments-notifications.md) for the new incremental migration, authorization test and manual setup. Live database/API verification remains pending.

## Project Activity and Discussion

Overview now includes shared Recent Activity and Project Discussion. See [setup, migration order and verification](docs/project-activity-discussion.md). Apply the new incremental migration manually; live database verification remains pending.

See [workspace and Calendar UI refinement](docs/ui-refinement.md) for the consolidated Calendar route, compact previews, account menu and action-feedback behavior. This UI increment requires no database migration.
