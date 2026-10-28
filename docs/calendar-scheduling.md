# Calendar and personal busy time

This enhancement extends the existing calendar and availability screens without changing the development phases. It does not schedule meetings or task work. Existing project membership, task permissions, priorities and section ordering are unchanged. Projects have no membership cap.

## Use

Open **Calendar** in the sidebar (also available without joining a project), or **Personal Calendar** from a project's Deadline Calendar. Add a personal busy event with a title, category, start/end, optional description and None/Daily/Weekly recurrence. Choose the next end date for overnight events. Select a calendar date to inspect your event details, deadlines and dynamically calculated **Suggested Availability**. Use Edit/Delete event or series; a series operation affects all occurrences, including past ones. Manage all definitions, including past events, in the expandable list below the calendar.

Project Deadline Calendar keeps its month navigation and My/All task filter. Deadline entries show status and priority and open existing Task Details. Personal reminders prioritize incomplete assignments and nearest/overdue deadlines. A deadline never creates a Busy block. Potentially Available means only that no recorded busy interval blocks that time; it is not a promise of availability.

Choose a project and open **Availability** to compare member timelines. Select any number of members and a date in the displayed week. Busy intervals and their complement are shown for each member, and the complement of everyone's combined busy time highlights common Potentially Available intervals. Members with no recorded time are explicitly marked unconfirmed. The compact Overview calendar marks today, Busy dates and assigned deadlines; selecting a date shows an agenda and a link to the full Calendar.

## Manual migration order

No remote operation was performed by the implementation agent. Confirm the intended disposable Supabase project in Dashboard before applying SQL. Run complete migration files once, as postgres, in this order:

1. `20261025000100_phase_2_foundation.sql` — only if not already applied.
2. `20261026000100_phase_3_integration.sql` — only if not already applied.
3. **`20261026000200_calendar_busy_events.sql`** — new Calendar migration.

Existing migration files are preserved. The new file is transactional, adds one `busy_events` table and narrowly scoped functions, and requests a PostgREST schema reload. It neither changes existing RLS policies nor deletes, renames or transforms existing data. Existing `availability_slots` remain explicit, project-scoped free-time records under **Previously recorded free-time slots**, with their existing edit and ownership rules. They are not copied into busy events or used to override suggested availability.

## Storage, recurrence and privacy

- Busy events are personal, rather than duplicated per project. Each series stores UTC endpoint instants, its IANA timezone and None/Daily/Weekly recurrence. The browser displays local times. The creation timezone is retained when editing from another timezone.
- The database expands recurrence only for the requested calendar window, using local calendar dates rather than fixed 24/168-hour increments. Weekly recurrences stay on their weekday across month/year changes; full endpoint dates support overnight/multiple-day ranges. Recurrence continues until the series is changed/deleted; no exceptions, recurrence-end feature or duplicated occurrence table is introduced.
- DST follows PostgreSQL named-timezone conversion: repeated/ambiguous local times use PostgreSQL's timezone resolution. Nonexistent recurrence times move through the gap; if transformed endpoints would make an empty/reversed block, the original positive local duration is used from the adjusted start. Initial input in a nonexistent local time is rejected by the existing local-time input validator. Intervals are `[start,end)` and are clipped to the viewed date/window.
- RLS and column grants permit only the owner to read/create/edit/delete private event rows. Ownership cannot be changed through the API. Anonymous table/RPC access is denied.
- `get_own_busy_occurrences` accepts no user ID and returns only the authenticated owner's occurrence IDs and time ranges. `get_project_busy_periods` checks the caller's current membership, derives the roster in the database and returns only `user_id`, `starts_at`, `ends_at`. Overlapping/adjacent intervals are merged, without exposing private series IDs, titles, categories, descriptions or recurrence metadata. It rejects unrelated or removed members.
- Expansion helpers cannot be called by runtime roles. Definer functions use trusted postgres ownership, empty search paths, explicit qualified relations, explicit execute grants and `auth.uid()` checks. No service key, external scheduler, realtime subscription or new dependency is used.

## Verification

Local verification completed: TypeScript, ESLint, formatting, all **90 tests in seven Vitest files**, and the production build passed. The build retains a warning for its main JavaScript bundle exceeding 500 kB. No database or browser test is included in that result.

Use the existing commands: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` (or `npm` outside PowerShell). Calendar component tests mock the API boundary; they do not prove hosted persistence, PostgreSQL recurrence or RLS. Interval tests cover overlap merging, exclusive ends, overnight clipping, multi-member comparisons and local month boundaries.

After applying migrations on a disposable project, run the **entire** `supabase/tests/calendar_authorization.sql` as postgres in SQL Editor. Its synthetic users and data are transactional and roll back; never change ROLLBACK to COMMIT. Accept the PASS result only when the entire script finishes without errors. On failure, save the first error and issue `ROLLBACK;` separately if needed. It checks private-row ownership, anonymous/teammate/unrelated access, restricted helper execution, the minimal team result shape, access revocation, overlapping occupancy, daily DST recurrence, weekly overnight recurrence and series edits/deletion. It has not been executed by the agent.

Manual acceptance remains: create/edit/delete events and recurring series through a real session, refresh for persistence, verify team-only Busy output and revoked access, navigate month/year and overnight dates, inspect dashboard markers and task links, and review mobile/desktop layouts and keyboard focus. No browser surface or PostgreSQL executable was available to the agent; live database/API and browser visual behavior are not claimed verified. All changes remain local; no migration execution, commit, push or deployment is authorized here.

## Changed files

- `src/features/calendar/`: typed queries, busy-event editor, month/date views, interval logic, team timelines and mini calendar.
- Calendar/Availability/Overview pages, router and app-shell navigation: connect the feature while retaining existing project routes and free-time controls.
- `src/types/database.ts`, `src/lib/data-client.ts`, `src/styles.css`: additive database types, missing-migration feedback and responsive neutral styles.
- `src/features/members/queries.ts`: paginate the existing display-roster RPC so large project rosters do not silently lose names at the API row limit.
- Calendar tests and shared API mocks; one existing test now expands the preserved free-time section before editing.
- New Calendar migration and rollback SQL checks, this guide, README, requirements and architecture notes. No development-phase reorganization or previous migration changes.

Timezone behavior follows [PostgreSQL date/time conversion](https://www.postgresql.org/docs/17/functions-datetime.html); restricted function grants and pinned search paths follow [Supabase database-function guidance](https://supabase.com/docs/guides/database/functions).
