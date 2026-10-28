# Task comments and in-app notifications

This owner-requested increment adds the specified comments and in-app activity center to the existing planner. It authorizes these two previously deferred features without reorganizing the development phases. Calendar, Suggested Availability, Team Availability and the My Tasks Mini Calendar are unchanged. No new dependency, realtime channel or external delivery service is introduced.

## User behavior

Task Details now includes **Comments**. Current project members can read/add plain-text comments in chronological order. The server records the authenticated author, minimal display-name snapshot and creation time. Only a comment's author, while still a member, can delete it. There is no comment editing, threading, mention/reaction system, attachment, rich text or chat room.

The navigation toolbar bell opens **Notifications**, with an unread count. Activity is loaded on application entry and after workspace refresh. Opening or refreshing the center also checks deadline reminders. Notifications show the activity, current project/task names, creation time and read state. **Mark as read** persists the read state; clicking an activity opens its existing task details. Clicking alone does not mark it read. There is no mark-all action, notification deletion or delivery outside the app.

## Event and recipient rules

| Actual database event                                                         | Recipients                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Task created with an assignee, or reassigned to a different non-null assignee | Newly assigned member, excluding the actor                                |
| Status changes to `done`                                                      | Other current project members; one completion event per recipient         |
| Other actual status change                                                    | Other current project members                                             |
| New comment                                                                   | Other current project members                                             |
| Deadline changes, including removal                                           | All other current project members, including the assignee when applicable |
| Incomplete assignment due in `(now, now + 24 hours]`                          | Its current assignee, checked when the center opens/refreshes             |

The database derives recipients from membership; frontend callers supply no recipient lists. No-op saves and unrelated changes (title, description, priority, steps, etc.) generate no notifications. Completion does not also emit a generic status notification. If a single task save changes multiple relevant fields, each distinct activity can produce its own notification; these represent different events. Unassignment has no newly assigned recipient. Administrative writes without an authenticated actor produce no activity notifications.

Reminders are unique by recipient, task and exact deadline, including concurrent refreshes. Reading a reminder does not allow it to regenerate. A genuinely different deadline permits a new reminder; changing back to an already-reminded deadline does not duplicate it. Completed/undated/overdue tasks and deadlines beyond 24 hours do not generate new reminders. Existing activity/reminders remain history after task changes; the saved reminder deadline is shown, even if it later changes. There are no background jobs, so opening the center after a deadline has passed does not retroactively create its reminder.

## Data and security

The additive migration introduces only `task_comments` and `notifications`, indexes, policies, trigger helpers and one reminder RPC. All previous migrations, policies and project lifecycle RPCs are preserved. Activity generation is transactional with the task/comment write. If notification generation fails, the originating write fails rather than falsely reporting delivery.

- Comments reference their task using a same-project composite FK. RLS requires current membership. Column grants prevent clients from supplying author IDs/names, timestamps or IDs; a trusted trigger validates identity and derives the display name. Clients have no UPDATE grant. Plain text is escaped by React.
- Notifications have no client INSERT/DELETE grant. Only `read_at` can be updated, and RLS checks both recipient identity and current membership. Project/task/recipient/kind/actor fields cannot be rewritten by a client.
- A recipient's membership FK cascades their project notifications on removal, preventing them from reappearing on rejoin. Current members retain historical comments by removed authors; the stored display name avoids exposing profile emails or requiring private-profile access.
- Task/project deletion cascades their comments and notifications. Existing task-assignment and leader-management rules remain unchanged. Projects have no member limit.
- Definer helpers have trusted postgres ownership, empty search paths and qualified relations. Trigger functions cannot be executed by runtime roles. Only authenticated users can execute `refresh_deadline_reminders()`, which takes no caller, recipient or task parameters and validates `auth.uid()`.
- Inbox queries paginate records and batch authorized task/project title lookups. Rows whose parent is no longer accessible are discarded. UI state resets on auth/project request changes; revoked access becomes visible on subsequent refresh. The app does not claim realtime delivery.

## Exact manual SQL Editor steps

No remote migration or test was executed by the implementation agent.

1. Select the intended **disposable** Supabase test project in Dashboard. Confirm previously applied migrations in order: Phase 2 `20261025000100`, Phase 3 `20261026000100`, Calendar `20261026000200`. Do not rerun already applied migrations.
2. Open **SQL Editor → New query**, select database role **postgres**, paste the **entire** `supabase/migrations/20261026000300_comments_notifications.sql`, clear text selection, and Run once. It starts a transaction, creates only the new feature structures, reloads the API schema and commits. Review the file before executing it. If it fails, retain the first error and run `ROLLBACK;` if the editor reports an aborted transaction. Do not partially rerun the file.
3. Open a separate new query as postgres. Paste and run the **entire** `supabase/tests/comments_notifications_authorization.sql`. It creates synthetic fixture accounts/projects only within a transaction and ends with **ROLLBACK**. Never replace rollback with commit. Accept its PASS result only when the whole file completes without errors. On failure save the first error, run `ROLLBACK;` if needed, fix locally and rerun the complete test. It simulates JWT claims under runtime roles; it is not a signed-token/API test.
4. Refresh the local app. With existing real test accounts, add/delete an own comment, attempt other-author deletion through the API, reassign a task, change status/completion/deadline and refresh the recipient inbox. Confirm no actor notification, one completion per recipient, no notification for a title-only/no-op save, and one reminder for the same upcoming deadline across repeated refreshes.
5. Mark an item read and reload to confirm persistence. Open its task link. Remove a regular member through the existing leader flow and confirm their refreshed comments/inbox access is revoked. Delete only clearly identified test projects through the leader UI after manual testing.

## Verification limits and files

Local verification passed: TypeScript, ESLint, formatting, **104 tests in eight Vitest files**, and the production build. The main bundle retains the existing size warning (over 500 kB). This result does not include live database or browser acceptance.

Run the existing commands: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` (use `npm` outside PowerShell). Local component tests mock feature queries, covering comment addition/deletion, safe text, errors, read state, refresh, task navigation and access-loss refresh. They do not prove PostgreSQL RLS, trigger delivery or real persisted sessions.

The rollback SQL suite covers current-member/anonymous/non-member checks, author impersonation, own-only deletion, lack of editing, cross-project parent protection, notification recipients, completion deduplication, no-op updates, reminder window boundaries/deduplication, private read state and member removal. It has not been executed here. Live persistence/API, database authorization and browser visual/keyboard acceptance remain manual checks; no PostgreSQL executable or browser surface was available in this session.

Changed files are the new `features/comments` and `features/notifications` modules; Task Details integration; the app-shell bell and focused styles; derived database types; query mocks and collaboration tests; the new migration and SQL suite; and this guide/README/requirements/architecture notes. No existing migration, Calendar logic or development-phase ordering was changed. No commit, push or deployment was performed.

Database generation follows PostgreSQL's [trigger execution model](https://www.postgresql.org/docs/current/trigger-definition.html) and [unique-index conflict handling](https://www.postgresql.org/docs/17/sql-insert.html).
