# TaskFlow — Technical Architecture (v1)

**Status:** Proposed implementation blueprint, not a description of an existing deployed system.  
**Stack:** React + TypeScript + Vite → Supabase JS → Supabase Auth / PostgreSQL / RLS.

## 1. System mental model

```text
Browser (React + TypeScript + Vite)
  ├─ React Router / protected routes
  ├─ Shared application shell and nine Figma-aligned screens
  ├─ Feature modules (auth, projects, tasks, members, calendar, availability)
  ├─ Typed Supabase query/mutation functions
  └─ Supabase JS client (publishable/anon key + user session)
                     │ HTTPS + user JWT
                     ▼
                Supabase
  ├─ Auth: Google OAuth / sessions / auth.users
  └─ PostgreSQL
       ├─ Data tables + foreign keys + indexes
       ├─ RLS policies on every scoped table
       └─ Limited security-definer functions for privileged atomic operations
```

**Security boundary:** the database verifies every query using the signed-in identity and project membership. UI route guards improve experience but are not authorization. The public client key does not bypass RLS.

No custom application server in v1. Do not use a browser service-role key. If future email notifications are approved, they will require a trusted scheduled/server-side component and a mail provider; neither is part of this architecture baseline.

## 2. Route structure

```text
/login                          Public Google OAuth entry
/auth/callback                  Auth completion handler if needed
/                               Redirect: authenticated → /my-tasks; otherwise /login
/my-tasks                       Global assigned tasks
/projects                       Global project list / create project
/projects/:projectId/overview   Selected-project overview
/projects/:projectId/tasks      All Tasks by section
/projects/:projectId/tasks/:id  Task Details (may render as panel/drawer)
/projects/:projectId/members    Project Members
/projects/:projectId/calendar   Deadline Calendar
/projects/:projectId/availability  Team Availability
```

If a drawer is used, the URL should remain shareable and work on refresh. A deep link must verify membership before showing content. Keep a consistent project switcher; selecting a project navigates to its overview or last visited project page.

## 3. Proposed database schema

Use UUID primary keys; `created_at timestamptz not null default now()` on major tables. Names below are recommended, not yet migrated. `auth.users` is managed by Supabase.

| Table | Key fields | Constraints / notes |
| --- | --- | --- |
| `profiles` | `id uuid PK REFERENCES auth.users(id)`, `email`, `display_name`, `avatar_url` | Minimal profile; do not use email as authorization identity; keep email synced/normalized |
| `projects` | `id`, `name`, `description`, `due_date date null`, `created_by uuid` | Creator FK; only members can view; creation via atomic function |
| `project_members` | `project_id`, `user_id`, `role` | Composite PK `(project_id,user_id)`; role `leader/member`; one leader/project enforced in database |
| `sections` | `id`, `project_id`, `name`, `position` | Unique `(project_id,id)` for composite FK; ordered per project |
| `tasks` | `id`, `project_id`, `section_id`, `title`, `description`, `guidance`, `status`, `assignee_id`, `due_at`, `position` | Composite section FK ensures same project; composite assignee FK ensures membership; `assignee_id` nullable |
| `task_steps` | `id`, `project_id`, `task_id`, `title`, `is_completed`, `position` | Composite FK `(project_id,task_id)` → tasks; project_id duplicated deliberately for simple RLS |
| `task_resources` | `id`, `project_id`, `task_id`, `title`, `url`, `description`, `position` | Same-project composite FK; validate URL in app and DB where practical |
| `availability_slots` | `id`, `project_id`, `user_id`, `starts_at`, `ends_at`, `created_at` | Composite FK `(project_id,user_id)` → project_members; `ends_at > starts_at`; only owner may mutate |

### Data relationships

```text
auth.users 1 ─── 0..1 profiles
     │
     └── 1 ─── * project_members * ─── 1 projects
                      │                    │
                      │                    ├── * sections ── * tasks
                      │                    │                    ├── * task_steps
                      │                    │                    └── * task_resources
                      └── * availability_slots

Each task has exactly one section and project.
Each task may have zero or one assignee who is a member of its project.
Each availability slot belongs to one project and its owning member.
```

Availability slots record **available/free time**, with an inclusive start and exclusive end; an absent slot makes no claim about whether the person is busy. Intersect these free-time ranges to find common availability. No busy/free flag is needed.

### Critical integrity details

- Add `UNIQUE (project_id,id)` to `sections` and `tasks`, then `FOREIGN KEY (project_id,section_id) REFERENCES sections(project_id,id)` and equivalent child-to-task composite FKs. This prevents a row from pointing to another project's section/task.
- For task assignees: `FOREIGN KEY (project_id,assignee_id) REFERENCES project_members(project_id,user_id) ON DELETE SET NULL (assignee_id)` **if supported by the target PostgreSQL version**; otherwise perform atomic unassignment in the leader-only removal function before deleting membership. Prefer the latter for explicit business semantics and portable migrations.
- For availability: `FOREIGN KEY (project_id,user_id)` to membership; remove a member's availability during atomic membership removal.
- A partial unique index on `project_members(project_id) WHERE role='leader'` enforces **at most** one leader. **At least** one leader is ensured by atomic project creation and by preventing leader deletion/demotion except project deletion. Avoid exposing unrestricted updates to membership roles.
- Status check: `status IN ('todo','in_progress','done')`.
- Positions are integers (or numeric ordering keys) and may have gaps. Enforce ordering per project/section at application level initially; use a transaction/RPC for multi-row reorder if necessary.
- Use `timestamptz` for exact deadline instants and availability. If date-only deadlines are desired, choose a separate `date` field rather than pretending midnight UTC is a date-only value. **Decision for v1:** use `due_at timestamptz null` with explicit local date/time selection; project-level `due_date date` may remain date-only.
- On deleting a project, cascade project-owned sections, tasks, steps, resources, availability and memberships. Trigger deletion only via leader-authorized operation with confirmation.

## 4. Authorization strategy (RLS)

### Membership helper

A plain policy that queries `project_members` from another `project_members` policy can recurse. Use a tightly controlled helper such as:

```sql
-- Illustrative design, not a complete migration.
create function public.is_project_member(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = (select auth.uid())
  );
$$;
```

Define the function owner and EXECUTE privileges deliberately; restrict invocation to authenticated roles as appropriate. Review `SECURITY DEFINER` privileges and use fully qualified table/function names. `auth.uid()` is null for unauthenticated requests. A similar `is_project_leader(project_id)` helper is needed.

### Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `projects` | member | atomic creation function; authenticated creator | member | leader via controlled operation |
| `project_members` | member | leader via controlled add-member function | no direct role updates | leader via controlled remove-member function |
| `sections` | member | member | member | member |
| `tasks` | member | member | member | member |
| `task_steps` | member | member | member | member |
| `task_resources` | member | member | member | member |
| `availability_slots` | member | authenticated member inserting own `user_id` | slot owner still member | slot owner still member |
| `profiles` | self only; teammate names through project-scoped display RPC | Auth provisioning trigger | self display name only | no client delete |

For inserts/updates, use `WITH CHECK` as well as `USING`; otherwise a user may move a record to an unauthorized project or change `user_id`. For child tables, RLS membership check must be based on their validated `project_id`.

**Important profile privacy:** Do not expose the entire users table or all registered users' emails. To support leader adding an existing user by email, create a narrowly scoped `add_project_member_by_email(project_id,email)` RPC that looks up the email on the trusted database side and returns only a success/controlled error. The RPC must validate the caller is project leader, normalize input, prevent duplicate membership, and not leak unrelated account details through general search. Decide on error wording that balances usability and account enumeration risk.

For Members and Assignee interfaces, `get_project_member_display(p_project_id)` returns only `(user_id, display_name)` for the requested project's roster, including the caller. It requires a non-null `auth.uid()` and current membership; missing, unknown and unauthorized projects receive the same permission error. It accepts no caller/user ID or email-search argument. Direct `profiles` reads remain self-only so teammate emails and creation timestamps stay private. Member roles are already available through the membership table's RLS; future UI can combine those records by user ID. Removal immediately blocks subsequent roster RPC calls and removes the person from roster results. The trusted `postgres` owner executes this narrowly scoped, read-only `SECURITY DEFINER` projection with `search_path = ''`, schema-qualified relations and authenticated-only EXECUTE privileges.

### Controlled operations (RPC / SQL functions)

1. `create_project(name,description,due_date)` — authenticated only; insert project and creator leader membership atomically; return project ID.
2. `add_project_member_by_email(project_id,email)` — leader only; find registered user, add `member`, handle duplicates; no email invitations in v1.
3. `remove_project_member(project_id,user_id)` — leader only; cannot remove leader; delete target's availability, unassign tasks, remove membership atomically.
4. `delete_project(project_id)` — leader only; deletes project with cascades, then no membership remains.
5. `get_project_member_display(p_project_id)` — member only; returns project-scoped user IDs/display names without exposing private profile fields.

Function parameters must not allow arbitrary `actor_user_id`; determine caller from `auth.uid()`. Grant EXECUTE narrowly and revoke default public privileges where appropriate. Write negative tests for every RPC.

## 5. Auth lifecycle

```text
User clicks Google sign-in
  → Supabase Auth OAuth redirect
  → Google consent/account selection
  → Auth callback / session established
  → React loads current user and minimal profile
  → My Tasks (global) or /projects (if empty)
```

The Supabase browser client normally persists/refreshes sessions. Use an auth provider/hook for loading and user state, subscribe to auth state changes, and clean up listeners. Protected routes should not briefly render project data while auth is unresolved. Logging out clears in-memory project data and redirects to login.

## 6. Query patterns and ownership

### My Tasks across projects

```ts
// Illustrative; generated DB types and error handling omitted.
const { data, error } = await supabase
  .from('tasks')
  .select('id, title, status, due_at, project_id, projects(name), sections(name)')
  .eq('assignee_id', user.id)
  .order('due_at', { ascending: true, nullsFirst: false });
```

RLS ensures this only returns authorized projects even if the query lacks an explicit membership join. Still verify query plan/indexing for performance.

### Project All Tasks

Query tasks filtered by `project_id`, with section and assignee/profile data as needed. Use a small number of batched queries, not one query per row. Project switch clears old data, updates route, then loads new data. Show pending/error states.

### Mutation handling

Use typed feature-level operations (`createTask`, `updateTask`, `setTaskAssignee`, `toggleStep`, etc.) and refetch/invalidate relevant views after success. For MVP, simple React state/hooks plus refetch is enough. Do not introduce realtime or elaborate optimistic synchronization without a clear need.

## 7. Availability intersection algorithm

Given selected members and a time window:

1. Fetch authorized slots for selected project and visible time range.
2. Convert all intervals to comparable UTC instants.
3. Clip intervals to requested range and merge overlaps **per member**.
4. Compute the intersection of each selected member's merged interval set (two-pointer sweep over sorted ranges).
5. Render the resulting intervals in the viewer's timezone; mark zero overlap clearly.

For example, A `[14:00,17:00]` and B `[15:00,18:00]` on the same date/timezone produce `[15:00,17:00]`. Store full timestamps so midnight-crossing ranges work. A week grid is a view of data, not the storage format.

## 8. UI/component structure

```text
src/
  app/
    router.tsx
    auth-provider.tsx
  pages/
    login-page.tsx
    my-tasks-page.tsx
    projects-page.tsx
    overview-page.tsx
    all-tasks-page.tsx
    task-detail-page.tsx
    members-page.tsx
    deadline-calendar-page.tsx
    availability-page.tsx
  components/
    ui/                    # shadcn-generated primitives
    layout/                # sidebar, project switcher, page header
  features/
    auth/                  # session and profile hooks
    projects/              # project queries/forms
    tasks/                 # task list, detail, steps, resources
    members/               # membership queries/actions
    calendar/              # deadline display
    availability/          # slots, time grid, overlap utility
  lib/
    supabase.ts
    dates.ts
  types/
    database.ts           # generated when configured
supabase/
  migrations/
  tests/
```

This is a suggested structure, not a mandate to create empty placeholder files. Prefer composition and local feature boundaries to excessive abstraction.

## 9. Security, quality and observability

- RLS negative tests: non-member read/write, cross-project child IDs, cross-project assignee, unauthorized membership changes, availability ownership, project deletion.
- DB constraints and migrations must be tested against a clean schema, not only an already-configured development database.
- Use input validation and safe resource URLs. Do not use `dangerouslySetInnerHTML` for guidance.
- Log errors in development without exposing tokens or personal data. Show user-friendly errors in UI.
- Index `project_members(user_id)`, `sections(project_id,position)`, `tasks(project_id,section_id,position)`, `tasks(assignee_id,due_at)`, `tasks(project_id,due_at)`, `availability_slots(project_id,starts_at)`; evaluate after real queries.
- Verify date rendering, keyboard navigation, responsive layout, and unauthorized states.

## 10. Deferred architecture

Do not implement realtime channels, mail queues, scheduled reminders, browser push, file storage, serverless functions, or external integrations during MVP. If later requested, design them separately with explicit permissions, opt-in, delivery and deduplication rules.
