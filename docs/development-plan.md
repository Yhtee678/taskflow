# TaskFlow — Development Plan

**Starting point:** Fresh repository with documentation and Figma references. Do not assume an app, database, CI pipeline, or deployment exists.  
**Delivery method:** Small vertical increments; each phase has demonstrable behavior, tests, and an approval checkpoint.  
**MVP order:** foundation → identity → projects/membership → tasks → task details → overview → deadlines → availability → hardening.

## Phase 0 — Confirm baseline and prepare repository

**Goal:** All contributors/agents agree on product and constraints before coding.

- Review `README.md`, `AGENTS.md`, requirements, architecture, and nine Figma screens.
- Confirm environment: Node LTS, npm, Git, Supabase project ownership, Google OAuth setup responsibility.
- Set up branch/review conventions and `.gitignore`; keep local secrets out of version control.
- Confirm no existing application implementation needs migration from the legacy Apps Script/Sheets prototype.

**Deliverable:** Reviewed documentation and clean repository.  
**Exit gate:** No unresolved disagreement about roles, project-scoped permissions, v1 scope, or Figma direction.

## Phase 1 — Frontend foundation and UI shell

**Goal:** A runnable React application that matches the existing visual language.

- Scaffold React + TS + Vite with strict TS and React Router.
- Configure Tailwind CSS, shadcn/ui, lint, formatting, Vitest, React Testing Library, and expected npm scripts.
- Implement responsive application shell, sidebar, project selector placeholder, page header, navigation and route-level placeholders.
- Recreate typography, spacing, colors, compact rows, controls, and focus states from Figma; no decorative redesign.
- Add `.env.example` and a typed Supabase client initializer; no hardcoded credentials.

**Demo:** App boots locally and navigates among nine screen shells with realistic mock data.  
**Checks:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.  
**Exit gate:** UI baseline approved before wiring business logic.

## Phase 2 — Supabase schema, Google login and security foundation

**Goal:** Reliable identity and database boundaries.

- Configure Supabase project and Google OAuth for localhost.
- Create versioned SQL migrations for profiles, projects, memberships, sections, tasks, steps, resources, availability; add constraints/indexes.
- Implement RLS helper functions and policies; carefully test recursion and `SECURITY DEFINER` privileges.
- Implement `create_project`, add/remove member, and delete-project RPCs with server-side caller validation.
- Build login/auth callback, persisted session handling, protected routes, logout, profile upsert.
- Seed **development-only** accounts/projects through safe scripts or fixtures; never expose service-role keys to browser.

**Demo:** Google sign-in works; refresh restores session; signed-out users cannot open protected routes.  
**Security gate:** Two authenticated test identities and two projects demonstrate isolation and rejection of unauthorized actions.  
**Exit gate:** RLS verified before shipping any real project data UI.

## Phase 3 — My Projects and membership lifecycle

**Goal:** A user can create/select projects and manage project membership safely.

- Implement My Projects list and create-project flow; show empty state for new accounts.
- Add project switcher and persist last selection locally as a convenience only.
- Implement project details edit for members.
- Implement Members page: roster, leader/member label, task count where available, add registered user by email (leader only), remove member (leader only), delete project (leader only).
- On removal, atomically unassign target's tasks and delete target's availability; clear unauthorized client state.

**Demo:** User A creates project, adds existing User B, and both see it; User C cannot access it.  
**Tests:** leader/member/non-member permission matrix; project creation and member removal edge cases.  
**Exit gate:** Project membership works independently of task management.

## Phase 4 — Sections, All Tasks and My Tasks

**Goal:** Real collaborative task CRUD, including cross-project personal task aggregation.

- Implement section CRUD and ordering.
- Implement task CRUD, status, assignee, due timestamp, ordering and selected-project All Tasks.
- Add status/assignee filtering and task search.
- Implement cross-project My Tasks with project labels and useful due-date ordering.
- Add loading, empty, error and deletion-confirmation states; keep Figma row density.
- Validate cross-project section/assignee constraints in PostgreSQL, not only UI.

**Demo:** Two members can create/edit/reassign each other's tasks; My Tasks combines assigned work from multiple projects.  
**Tests:** CRUD, filters, unauthorized direct queries, cross-project assignment rejection.  
**Exit gate:** The central task workflow is fully usable.

## Phase 5 — Task Details: guidance, steps and resources

**Goal:** Every task contains enough information to execute without separate messages.

- Implement task details view/panel consistent with Figma, preserving deep-link/refresh behavior.
- Add editable description, guidance, assignee, status, section, deadline.
- Add ordered optional steps: create/edit/check/delete/reorder.
- Add multiple titled resource links with optional description; validate safe URLs.
- Make all project members able to edit any project task and its children.

**Demo:** Open a task, edit guidance, check steps, attach multiple URLs, refresh and see persisted data.  
**Tests:** child-table RLS, URL validation, step completion independence from task status.  
**Exit gate:** Task details complete and robust.

## Phase 6 — Project Overview and Deadline Calendar

**Goal:** Provide progress and time visibility without distracting dashboards.

- Implement derived project counts and per-section progress.
- Build selected-project monthly Deadline Calendar, month navigation and My/All filter.
- Open task details from calendar entries.
- Handle exact due timestamps and local-time rendering consistently; no-date tasks stay off calendar.
- Keep Overview visually restrained; avoid redundant giant KPI cards.

**Demo:** Change task status/due date; overview and calendar reflect changes after refetch.  
**Tests:** count accuracy, My/All filtering, timezone boundary cases.  
**Exit gate:** Deadline view and progress summaries reliable.

## Phase 7 — Team Availability (core MVP)

**Goal:** Members can record free time and identify shared availability.

- Implement add/edit/delete own availability time ranges within selected project.
- Implement calendar/time-grid presentation and member filters; allow reviewing teammates' slots.
- Merge overlapping slots per person and compute common intersections for selected members.
- Handle date changes, local timezone display, overnight ranges, and empty overlaps.
- Ensure RLS allows reading teammates' slots but only editing one's own.

**Demo:** A enters 14:00–17:00, B enters 15:00–18:00; UI shows 15:00–17:00 common availability.  
**Tests:** overlap algorithm, ownership, membership isolation, invalid intervals, timezone display.  
**Exit gate:** Team can coordinate meeting times within TaskFlow.

## Phase 8 — Polish, end-to-end validation and release readiness

**Goal:** A cohesive, reliable MVP rather than a collection of demos.

- Audit all nine screens against Figma for layout, density, typography and interaction.
- Verify desktop and mobile usability, keyboard focus, accessibility labels, empty/loading/error states.
- Run unit/component tests, database/RLS negative tests, production build and manual end-to-end journeys.
- Check OAuth redirect URLs, secrets, RLS policies, indexes, database migrations and sign-out behavior.
- Document exact setup commands, current scripts and known limitations.
- Prepare deployment plan; **do not deploy without approval**.

**End-to-end journeys:** first-time login → create project → add registered member → create section/task → assign → edit teammate's task → add steps/resources → see My Tasks → view deadline → compare availability → remove member → verify revoked access.

**Exit gate:** Owner accepts MVP after demonstrable behavior and security checks.

## Phase-by-phase progress reporting

After each phase, report:

```text
Phase:
Implemented:
Files changed:
Database migrations:
Tests/commands actually run:
Result (pass/fail/blocker):
Known limitations:
Next phase / decision needed:
```

Do not mark a phase complete if its security tests are missing. Prefer one coherent pull request or reviewable change per vertical increment; no forced commit schedule.

## Dependencies and critical path

```text
Docs / UI approval
    ↓
Frontend foundation ────────────┐
    ↓                           │
Auth + Schema + RLS             │
    ↓                           │
Projects + Membership           │
    ↓                           │
Sections + Tasks + My Tasks     │
    ├── Task Details            │
    ├── Overview / Deadlines    │
    └── Availability            │
             ↓                  │
      Integration / QA ◄────────┘
             ↓
      Deployment approval
```

## Explicitly deferred backlog

- In-app notifications and notification center
- Email reminders / opt-in settings / scheduler / provider
- Browser push notifications
- Realtime updates and conflict resolution
- Public invitations / invite emails
- Kanban, Gantt, file uploads, comments, external calendar integration
- Complex roles, organizations/workspaces, billing, advanced analytics

Do not start backlog items without an explicit scope decision.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| RLS recursion or privilege escalation | Membership helpers/RPC review, negative tests before UI integration |
| Incorrect cross-project assignment | Composite FK and authorization tests |
| Member removal breaks task FK | Atomic unassignment and slot deletion before membership deletion |
| OAuth callback fails across environments | Configure redirect allowlists; test localhost before deployment |
| Availability timezone errors | UTC timestamps, explicit local conversion, overlap unit tests |
| Agent-generated UI diverges from Figma | Screen-by-screen visual review; prohibit generic dashboard redesign |
| Scope creep | Strict MUST vs LATER boundaries and phase gates |
| Too much architecture too early | No custom server/realtime/notifications in v1 |

## First Codex assignment (recommended)

> Read `README.md`, `AGENTS.md`, and all files in `docs/` before editing. Implement **Phase 1 only**: scaffold React + TypeScript + Vite, configure React Router, Tailwind, shadcn/ui, lint/typecheck/test/build, and create the responsive app shell aligned with the existing nine-screen Figma design. Use mock data for page shells; do not create database tables, enable OAuth, deploy, commit, or push. Report all files changed, commands run, test results, and anything needing approval.
