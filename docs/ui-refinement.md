# Workspace and Calendar presentation refinement

This increment changes presentation and navigation only. No SQL, schema, RLS, authentication, task filtering, notification generation, busy-event mutations, recurrence or availability calculations were changed. Existing typography, table behavior, mobile bottom navigation and the cross-project My Tasks description were already in place and retained.

## Updated workspace

- My Tasks reuses the project activity component with a compact three-entry preview before the current project title. Its link opens the full Overview history. The selected project changes this preview and heading context, not the underlying cross-project assigned-task query/filter behavior.
- The right column retains Mini Calendar, now separated into selected-date details, upcoming personal events, upcoming assigned deadlines and full-calendar navigation. Task links retain status/priority/deadline information and wrap long titles. Empty sections show `—`.
- My Availability sits below the calendar. The same personal-calendar response supplies both previews, including today when another month is viewed. The preview reuses `DayPeriods`, overlap merging and Potentially Available calculations. It has no CRUD controls and does not claim unrecorded time is confirmed free.
- Calendar date details have separate Suggested Availability, My Busy Events and Task Deadlines sections, plus a distinct incomplete-assignment section. Existing event/series controls and reminder filtering/sorting are unchanged. Time ranges stay adjacent to their labels. Presentation now uses **End of Day** for exclusive daily boundaries and explicit dates for actual overnight events.

## My Tasks presentation follow-up

The banner emphasizes the live time and motivation, with supporting date, availability and task summary. Its redundant disclaimer is removed. The activity preview keeps its location and internal scrolling while separating actions from task titles and using concise local timestamps; full Overview history is unchanged. Empty mini-calendar sections use compact spacing. Today's availability uses a concise no-busy-event state, retaining the existing interval display whenever an occurrence overlaps today, including overnight events. Filters use a container-responsive grid: one row with sufficient width, otherwise search above two paired rows of dropdowns.

This follow-up changes presentation only. Queries, interval calculations, task completion, navigation and permissions are unchanged. Automated checks passed: TypeScript, ESLint, production build, the full 154-test suite, then the focused 16-test suite after two additional activity-presentation tests. The existing bundle-size warning remains. Manual browser review at 375px, 768px and 1440px is still required for visual hierarchy, wrapping, scrollbar behavior, keyboard scrolling and filter alignment.

## Consolidated Calendar navigation

The sidebar and mobile bottom navigation expose one **Calendar** entry at `/calendar`. The legacy `/projects/:projectId/calendar` route redirects with replacement to `/calendar?project=:projectId`, preserving its selected-project My/All deadline view. **Project deadlines** in Calendar opens that existing selected-project scope; **Personal Calendar** returns to the global assigned-task view. Project membership is still checked by the existing project loader/RLS before any project data renders. Old links remain usable, and no deadlines are deleted or recalculated.

## Sidebar and feedback

Native project selectors retain their existing controlled values, keyboard behavior and switching callbacks. Long selected names have a full wrapping caption and tooltip, with constrained widths instead of sidebar overflow. Account controls are grouped under the avatar/name menu on desktop and mobile More. Enter/Space, arrow keys, Home/End, Tab and Escape remain keyboard-accessible; editing and sign-out use existing callbacks and forms.

Action-feedback success toasts disappear after three seconds; new messages get a fresh timeout. Errors persist until dismissal, another action or navigation. Feedback is fixed outside page flow, uses live-region status/alert semantics and has a dismiss control. Route changes clear transient feedback. Active dialogs retain their existing inline error display so errors are readable in the dialog top layer. These are own-action responses only; incoming activity still appears solely in the Bell center, with no popup/realtime behavior.

Obsolete user-facing preview/account labels were removed while retaining TaskFlow branding.

## Files

Changes are confined to My Tasks, Calendar/legacy redirect pages, router integration, the activity preview presentation, mini-calendar/day-period/time/task presentation components, sidebar account/project controls, action feedback provider/toast, focused styles and tests. Existing task/calendar query helpers are reused. No dependency or database file was added or changed.

## Verification and manual browser review

Local verification passed: TypeScript, ESLint, formatting, **135 tests in eleven Vitest files**, and the production build. The existing JavaScript bundle-size warning remains. A production-source search found no obsolete frontend-preview or authenticated-account labels. No remote database operation was performed.

Run the existing TypeScript, lint, Vitest and production-build commands. Tests cover preview ordering, one shared schedule read, mini-calendar sections/month navigation, read-only availability, legacy redirect/project scope, calendar sections, long-name selection, account editing/sign-out/keyboard behavior, and toast timeout/error/dismiss/navigation behavior. Existing business-flow regression tests remain included. Tests mock API queries and do not change hosted data.

No browser surface was available to the implementation agent. Manually review 375px, 768px and 1440px layouts: right-column stacking, long task/project/user names, table-contained scrolling, native select option readability, mini-calendar markers and date selection, full-calendar event/series editing and task links, account menu focus/Escape/Tab and return from the name editor, and toast placement above mobile navigation/safe areas. Verify errors stay readable inside open dialogs and that incoming notifications create no toast. No new Supabase setup or migration is required for this UI increment.
