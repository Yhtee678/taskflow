# My Tasks completion shortcut and context banner

This increment is limited to My Tasks. Other task tables, Task Details status editing, Calendar calculations, Mini Calendar/availability controls, SQL migrations, RLS and event-generation functions are unchanged.

## Completion control

The circle is now a separate keyboard-accessible button beside the title link. To do/In Progress change to Done; Done changes to To do. The title retains its original Task Details destination. The control sends a status-only update through `saveTask` and the existing workspace mutation/refetch flow, avoiding stale overwrites of title, assignment or other fields. Existing database status triggers remain the sole activity/notification producers.

An optimistic status is used consistently by the task list, its filters/counts, the banner and the Mini Calendar. A synchronous per-task in-flight guard plus disabled controls prevents rapid duplicate writes. Failures restore the previous task status and use existing action-error feedback. Successful mutations refetch authorized data. My Tasks filter selections are kept in authenticated workspace UI state through this refetch, then reset on actual navigation/identity changes as before; the filter function and task query are unchanged.

## Layout

The order is banner, current project title, selected-project Recent Activity preview, My Tasks heading/description, filters and assigned tasks. The existing activity list has a maximum 200px card height and internal vertical scrolling. Its heading and full-history link stay outside the scroll area. The right column retains Mini Calendar and My Availability.

## Current time and context

The banner reuses global assigned tasks and the Mini Calendar's existing personal-calendar response. It runs the existing Potentially Available calculation over the authoritative busy occurrences; recurrence and overnight expansion remain on the existing path. No duplicate availability algorithm, data query or background service was introduced. Loading/failed/uncovered schedule data is explicitly unknown and never treated as free.

Message priority is overdue work, all assigned tasks completed, currently busy, approaching deadline, unfinished work and no assignments. An approaching deadline uses the existing 24-hour reminder window; the nearest future incomplete-task deadline is always available as context. Completed tasks are excluded from pending/overdue counts. The availability label is independent of the task message, so an overdue/all-completed message can still accurately show Currently busy. Unrecorded time is only Potentially Available, never confirmed free. Messages are deterministic, without random quotes.

The local display timer updates at the next minute or earlier busy/deadline boundary, and resynchronizes on focus/visibility changes. It cleans up timers/listeners on unmount. Clock ticks do not poll data. The existing personal-calendar query key changes only when its actual coverage/user/revision changes, including a needed day rollover, while supplying both the banner and existing sidebar.

## Verification and manual checks

Local checks passed: TypeScript, ESLint, formatting, **152 tests in twelve Vitest files**, and the production build. The existing bundle-size warning remains. No live Supabase or browser acceptance test was executed.

Run the existing TypeScript, lint, Vitest and production-build commands. New tests cover all three status transitions, no-navigation/button vs title behavior, optimistic duplicate blocking, rollback, filter retention after refetch, layout order, message priority, overlap/overnight/exclusive-end handling, timer cleanup and busy-boundary updates without extra task/schedule reads. These tests mock API queries; they do not verify live Supabase persistence or trigger delivery.

Manual acceptance remains: at approximately 375px, 768px and 1440px inspect the banner, 200px activity card/list scrolling, visible history link, long-title wrapping and unchanged sidebar. Test keyboard Space/Enter on completion, title navigation and status filters. With real authorized data, confirm status persists on refresh and the existing shared activity, recipient notifications, Overview totals and Calendar reflect the successful status change. No remote database mutation was performed by the implementation agent. No schema setup, migration, dependency, commit, push or deployment is required by this UI increment.

Files: My Tasks page; optional My Tasks controls in TaskList; status-only `saveTask` typing/update path; optional PageHeader project heading; shared schedule snapshot publication in MiniCalendar; banner state/view/local timer; workspace filter UI state; scoped styles; focused tests and the updated ordering assertion in the earlier UI test.
