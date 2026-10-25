# AGENTS.md — TaskFlow Engineering Instructions

This file is binding guidance for coding agents (including Codex) and contributors. Read it together with `docs/requirements.md`, `docs/architecture.md`, and `docs/development-plan.md` **before** implementing anything.

## 1. Operating principles

- Implement the **smallest complete increment** that satisfies the active development phase.
- The written requirements define behavior; the existing Figma file defines visual direction. Do not substitute a generic template.
- Prefer straightforward, maintainable React and SQL over premature abstraction.
- Do not silently change scope, architecture, role permissions, or schema. Explain the trade-off and request approval for material deviations.
- Report what changed, which files changed, commands/tests run, results, limitations, and the next recommended step. Never claim tests passed unless they ran.
- **Do not commit, push, deploy, delete remote resources, or mutate the hosted database without explicit permission.** Prepare local changes and show them for review.
- Do not fabricate GitHub history, team participation, test evidence, or engineering practices.

## 2. Fixed technology decisions

Use React + TypeScript + Vite, React Router, Tailwind CSS, shadcn/ui, Supabase Auth, PostgreSQL, RLS, and Supabase JS. Use TypeScript strict mode. Prefer feature-oriented folders and typed query helpers. Zod is appropriate at form/input boundaries. Vitest + React Testing Library are the default unit/component testing tools.

Do **not** introduce Next.js, Express/NestJS, Prisma, Drizzle, Redux, Docker, Apps Script, Sheets, a custom authentication server, or a complex state management library unless the owner explicitly approves a change.

No email notifications, browser push, in-app notifications, or realtime subscriptions in MVP.

## 3. UI rules — no generic AI-generated aesthetic

**Reference:** https://www.figma.com/design/oOU4WPTBqP6EdO5YIiGfsx

The nine named screens are the baseline. Preserve the restrained white workspace, pale-gray sidebar, clean Inter typography, compact section headers, dense task rows, subtle borders, and functional visual hierarchy. Use existing patterns and shadcn primitives where they match. Match the screen's actual spacing and behavior rather than approximating from memory.

Avoid: large decorative KPI cards, random gradients, glassmorphism, glow effects, excessive shadows, oversized radii, emoji icons, ornamental illustrations, meaningless charts, forced three-column layouts, and verbose AI-sounding UI copy. Do not redesign an approved screen without being asked.

UI priorities: readable task titles, keyboard/focus accessibility, minimal clicks, responsive overflow behavior, predictable inline actions, and clear loading/empty/error states. Prefer accessible semantic controls. Do not introduce new views just because a library provides them.

**Screen behavior:**
- Sign in: one clear Google action; handle loading/error/redirect.
- My Tasks: cross-project assigned tasks; project name visible on each item.
- My Projects: membership-based project selection and project creation.
- Overview: selected-project progress only.
- All Tasks: selected-project sections and all members' tasks; filter by assignee/status.
- Task Details: description, guidance, steps, resource links, assignee, status, deadline, section; editable by all project members.
- Members: selected-project membership and work visibility; leader-only membership actions.
- Deadline Calendar: selected-project deadlines with My/All filtering; do not conflate with availability.
- Availability: member time ranges, editable own slots, team overlap exploration.

## 4. Security and permissions are non-negotiable

- Google OAuth through Supabase Auth. Use persisted sessions and protected routes; do not store raw tokens in custom application tables.
- Project membership, **not** merely login, authorizes access to project data.
- `leader` and `member` are **project-scoped roles**. The creator becomes leader. Any authenticated user can create a project and lead it.
- All project members can view/edit all tasks, including tasks assigned to someone else; only leaders may add/remove project members and delete their project.
- Task assignees must belong to the task's project. No unauthorized self-join, cross-project assignments, or access via guessed IDs.
- RLS must protect every project-scoped table, including indirect child tables (`task_steps`, `task_resources`, `availability_slots`). The client UI is **not** an authorization boundary.
- Membership mutation and creator/leader lifecycle need explicit database enforcement. Prefer narrowly scoped, auditable SECURITY DEFINER functions for operations that would otherwise cause recursive RLS policies; pin `search_path` and validate `auth.uid()` inside them.
- No service-role key or OAuth secret in frontend code or `VITE_*` variables.
- Validate URLs and text; treat user-provided resource links as untrusted. Never inject raw HTML.

## 5. Data and application rules

- One user may join multiple projects; there is **no workspace entity** in v1.
- My Tasks is an aggregated view across authorized projects; All Tasks is a selected-project view.
- Sections are ordered within a project. Tasks belong to exactly one project and one section in that project.
- Steps and resources are ordered child records. Steps are optional and independently checkable.
- Availability is stored as timestamp ranges (UTC in PostgreSQL, converted to user-local display). A slot has a start strictly before its end. v1 availability is **project-scoped** to avoid leaking schedule details to unrelated teams.
- Calendar deadlines and availability are separate concepts. The calendar does not imply notification delivery.
- After mutations, update/refetch relevant queries. Realtime is deferred.
- Use database constraints to enforce relationships and uniqueness, not only form validation.

## 6. Suggested organization

```text
src/
  app/               # Router, providers, route guards
  pages/             # Screen-level composition
  components/ui/     # shadcn primitives
  components/layout/ # Sidebar, headers, app shell
  features/
    auth/
    projects/
    tasks/
    members/
    calendar/
    availability/
  lib/               # Supabase client, utilities
  types/             # Shared app/database types
supabase/
  migrations/        # Versioned SQL
  tests/             # RLS/database checks when available
docs/
```

Keep domain queries close to features; avoid a giant universal service file. Use generated Supabase database types when configured. Avoid introducing state libraries for server data until demonstrated need.

## 7. Definition of Done for a feature

A feature is done only when:

1. It meets its written acceptance criteria and respects the approved Figma direction.
2. Loading, empty, error, and unauthorized states are handled.
3. Typecheck, lint, relevant tests, and build pass (or exact blockers are reported).
4. Database changes are in migrations and have authorization tests where relevant.
5. Accessibility basics are checked (labels, focus, keyboard, contrast).
6. Documentation is updated for meaningful behavior/schema changes.
7. The owner has reviewed any irreversible, deployment, or security-sensitive action.

## 8. Agent task workflow

For each requested task: (a) read the applicable phase and files, (b) briefly state the implementation plan, (c) implement only that scope, (d) run relevant checks, (e) summarize exact results and outstanding decisions. Stop and ask if a decision affects privacy, membership, database migration safety, or approved UI behavior.

Do not build the entire app in a single unreviewable change. Do not label a screen 'complete' because it looks plausible; test actual flows.
