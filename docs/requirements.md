# TaskFlow — Product Requirements (v1)

**Status:** Approved functional baseline; implementation not started.  
**Reference UI:** https://www.figma.com/design/oOU4WPTBqP6EdO5YIiGfsx  
**Priority vocabulary:** MUST = MVP; SHOULD = polish if feasible; LATER = explicitly deferred.

## 1. Product intent

TaskFlow supports small teams managing assignments and collaborative projects. It should answer four questions quickly: **What do I need to do? What is everyone working on? When is it due? When can we meet?** It is not a full enterprise work-management suite.

### Success criteria

- A returning user normally reaches their personal task list without another login prompt.
- A member can find and update an assigned task in a few interactions.
- A member can view and edit teammates' tasks within a shared project.
- Unrelated projects and their tasks/members/availability remain inaccessible.
- A group can identify shared free time without external spreadsheets.
- The interface remains visually faithful to the nine approved Figma screens.

## 2. Roles and terminology

**User:** an authenticated account. **Project:** an independent collaborative space, with its own membership and sections. **Project leader:** project creator or designated leader with member-management/deletion privileges. **Member:** regular project collaborator. **Assignee:** member responsible for a task; not its exclusive editor. **Section:** ordered group of tasks. **Task:** work item with details and deadline. **Step:** optional checklist item. **Resource:** reference URL. **Availability slot:** a time interval a member reports as available within a project.

No workspace hierarchy exists in v1. A user can belong to multiple projects and have a different role in each.

## 3. Access and permissions

| Operation | Authenticated non-member | Project member | Project leader |
| --- | --- | --- | --- |
| Create a new project | Yes (becomes its leader) | Yes (for a new project) | Yes (for a new project) |
| View a project's content | No | Yes | Yes |
| Edit project name/description/due date | No | Yes | Yes |
| Create/reorder/edit/delete sections | No | Yes | Yes |
| Create/edit/delete tasks | No | Yes | Yes |
| Assign/reassign any task to a project member | No | Yes | Yes |
| Edit steps, guidance, resources | No | Yes | Yes |
| View project members and project availability | No | Yes | Yes |
| Create/edit/delete **own** availability slots | No | Yes | Yes |
| Edit another member's availability | No | No | No |
| Add/remove project members | No | No | Yes |
| Delete the project | No | No | Yes |

**Important:** member-level collaboration includes editing tasks assigned to others. Identity is never selected by choosing a name from a dropdown. Member filters only change the view.

### Membership lifecycle rules

- Project creation is atomic: project and creator's `leader` membership must be created together.
- Leaders may add **existing registered users** by exact email. v1 does not send invitations or provision accounts for unregistered emails.
- A project must retain a leader. v1 has **one leader per project**; leadership transfer is out of scope unless explicitly approved. The current leader cannot remove their own leader membership through the member-management UI.
- A leader may remove a regular member. Tasks assigned to that person must be unassigned as part of removal, or removal must be blocked with a clear remediation message; choose and implement one consistent rule. **Selected v1 rule:** unassign their tasks atomically on removal.
- Removed members immediately lose access on subsequent authorized queries/mutations. Stale browser data should be cleared on permission errors or project switching.
- There is no public join link or self-enrollment in MVP.

## 4. Navigation and nine screens

| Screen | Scope | Primary job |
| --- | --- | --- |
| 01 My Tasks | Across all joined projects | See work assigned to the signed-in user |
| 02 Task Details | Selected task/project | Read/edit task, steps, guidance, resources, assignee, due date |
| 03 Overview | Selected project | See project progress and sections |
| 04 All Tasks | Selected project | View/edit all project tasks, filter by member/status |
| 05 Availability | Selected project | Add own available time ranges, view team availability and overlap |
| 06 Sign in | Global | Google OAuth login |
| 07 My Projects | Across joined projects | Create/select projects |
| 08 Project Members | Selected project | View members; leader manages membership |
| 09 Deadline Calendar | Selected project | See deadlines, filter My/All |

The sidebar and project selector should make global vs project-specific context obvious. Project selection persists locally for convenience but **never** confers authorization.

## 5. Functional requirements and acceptance criteria

### FR-01 Authentication — MUST

- Google OAuth via Supabase Auth. Restore a valid persisted session; show sign-in if none exists.
- Handle auth callback, loading, sign-out, and login failure states.
- On first login, create or upsert a minimal profile (display name/email as needed), without granting project membership.
- **Acceptance:** after first successful sign-in, refresh normally retains the session; sign-out blocks protected screens; invalid session routes to Sign in.

### FR-02 My Projects and membership — MUST

- List only projects joined by current user, with title and useful metadata.
- Create project with name (required), description (optional), due date (optional); creator becomes leader.
- Project members may edit project basics. Leader may add registered users by email, remove members, and delete project with explicit confirmation.
- **Acceptance:** two users in different projects cannot list/open each other's project; leader actions succeed, member attempts are rejected by RLS/database, not just hidden buttons.

### FR-03 My Tasks — MUST

- Show all tasks whose assignee is current user across all joined projects.
- Include project label, section, status, and due date when present. Support status/project filters and sensible sorting (overdue, upcoming, undated).
- A task click opens details in its project context.
- **Acceptance:** task assigned to user in two different projects appears in one view; unassigned and others' tasks do not; removal from a project removes its tasks from results.

### FR-04 Sections and All Tasks — MUST

- Each project has ordered sections; project members may create, rename, reorder, and delete sections.
- Tasks are grouped under sections. Provide quick add, search, status filter, assignee filter, and useful empty states.
- Deleting a non-empty section is a destructive operation: require explicit confirmation; for v1, delete contained tasks and their children in the same transaction through FK cascades, with clear warning of the number affected.
- **Acceptance:** edits are visible after refetch; tasks cannot be moved to a section in another project; non-members cannot read or modify rows by ID.

### FR-05 Task CRUD and assignment — MUST

- Fields: title (required), description (optional), guidance (optional multiline), status (`todo`, `in_progress`, `done`), assignee (optional project member), due date/time (optional), section, ordering position.
- All project members may create/edit/delete and reassign any task in their project.
- Use confirmation for destructive deletion. Support unassigned tasks.
- **Acceptance:** member B can edit a task assigned to member A; assignment to an outsider is rejected at database level; task status changes update My Tasks/Overview/Calendar after refetch.

### FR-06 Task steps — MUST

- Optional, ordered checklist items with text and completion state; add/edit/toggle/delete/reorder.
- Step completion does **not** automatically mark the parent task `done`; task status is explicit.
- **Acceptance:** all project members can toggle steps; child records from unrelated projects are inaccessible.

### FR-07 Guidance and resources — MUST

- Task guidance is plain multiline text (not rich-text HTML).
- Each task supports multiple ordered resource links with title, URL, optional description.
- Links must be validated for safe `https:`/`http:` schemes and opened safely (`rel="noopener noreferrer"`).
- **Acceptance:** invalid/malicious URL schemes are rejected; resources persist and are editable by project members.

### FR-08 Overview — MUST

- Selected-project total, todo, in-progress, done counts; progress by section; optionally show near-term deadlines without duplicate decoration.
- Derived data, not manually maintained counters.
- **Acceptance:** counts match tasks and update after mutations/refetch; no other project's data appears.

### FR-09 Deadline Calendar — MUST

- Selected-project month view with tasks carrying due dates; My/All filter.
- Clicking a task opens details. Navigate months and highlight current day. Render dates in user's local timezone.
- **Acceptance:** no-due-date tasks do not appear on calendar; moving due date moves calendar item; My shows only current user's assigned tasks.

### FR-10 Availability — MUST

- Within each project, a member may add, edit, or delete **their own** available date/time ranges.
- Display team members' slots, filter by member, and highlight overlapping time windows for selected participants.
- The MVP can compute intersections client-side from authorized slots; no scheduling optimization service required.
- Timezone-safe storage and display; no zero/negative-length slots. Overlapping slots from the same user may be allowed initially but should be merged for overlap calculations to prevent double-counting.
- **Acceptance:** user A cannot modify user B's availability even by API call; a slot such as 14:00–17:00 displays consistently; a common interval is correctly identified when at least two members overlap.

### FR-11 Feedback and resilience — MUST

- Clear loading, error, empty, unauthorized, and confirmation states.
- Refresh relevant data after mutations; avoid stale task counts.
- Keyboard-accessible controls and visible focus; mobile layouts must remain usable even if desktop-first.
- **Acceptance:** offline/network failures show a recoverable error; unauthorized project IDs do not expose data.

## 6. Important edge cases

- New user with no projects: show create-project empty state.
- Member belongs to many projects: preserve project context when navigating; My Tasks remains global.
- Task without assignee/due date: valid; appears in All Tasks but not My Tasks/deadline calendar.
- Leader removes member who has tasks: unassign those tasks atomically.
- Concurrent edits: v1 uses last successful write wins; refresh after mutation and show failures. Realtime/conflict resolution is deferred.
- User loses membership while viewing project: clear project-scoped data and redirect to My Projects.
- Resource link with `javascript:` or `data:` scheme: reject.
- Time ranges crossing midnight: allowed if stored as full start/end timestamps; show on appropriate date(s).
- Deadline date-only vs exact timestamp: UI may offer both, but data model must make the distinction explicit (see architecture). Do not silently shift a date-only deadline due to timezone conversion.

## 7. Non-functional requirements

- **Security:** RLS and constraints on every scoped table; negative authorization tests; no secrets in client.
- **Usability:** compact, consistent Figma-aligned layout; efficient task editing; accessible interaction.
- **Performance:** avoid N+1 requests for task lists; indexes for membership, assignee, due dates, and ordering; pagination if volume grows.
- **Maintainability:** strict TS, modular features, versioned migrations, meaningful tests, clear errors.
- **Privacy:** availability and project data visible only to members of the corresponding project.
- **Data integrity:** same-project FK constraints, atomic membership operations, ordered child records.

## 8. Out of scope for v1

In-app/email/push notifications; realtime subscriptions; public invite links; invitation emails; leadership transfer; external calendar sync; file attachments; comments/chat; subtasks nested recursively; time tracking; complex approval workflows; organization/workspace hierarchy; Kanban/Gantt; billing; analytics beyond simple progress.

Google login email is a future notification address **only if the user opts in** and a separate notification backend is implemented. Logging in does not send reminders.

## 9. Acceptance scenarios (Given / When / Then)

1. **My Tasks:** Given Alex belongs to Project A and B, when Alex opens My Tasks, then only tasks assigned to Alex from both authorized projects appear with project labels.
2. **Transparency:** Given Alex and Brandon belong to A, when Brandon edits a task assigned to Alex, then the edit succeeds and is visible to A's members after refetch.
3. **Isolation:** Given Cheryl is not a member of A, when she queries A's tasks or steps by ID, then the database returns no authorized rows or rejects mutation.
4. **Assignment integrity:** Given Daniel belongs only to B, when a member of A assigns an A task to Daniel, then the database rejects the assignment.
5. **Member removal:** Given Brandon has assigned tasks in A, when A's leader removes Brandon, then Brandon's A tasks become unassigned and Brandon loses access.
6. **Availability:** Given Alex is free 14:00–17:00 and Brandon 15:00–18:00 on the same day, when both are selected, then the common availability is 15:00–17:00.
7. **Leader authorization:** Given a regular member attempts to add another member or delete a project, then the database rejects the action.
8. **Session:** Given Alex has a valid persisted session, when the page reloads, then Alex returns to the application without an unnecessary login prompt.

## 10. Open implementation choices (not product scope changes)

- Whether due dates are date-only or datetime per task: recommend a `due_at timestamptz` plus optional `due_date date` only if date-only UX is required; choose one unambiguous UI contract before migration.
- Whether project list search/sort is in initial phase or polish.
- Whether overlapping availability should be shown as a separate suggested-meeting panel or highlighted directly in weekly grid.

Resolve these during the relevant phase and update the requirements and schema together.
