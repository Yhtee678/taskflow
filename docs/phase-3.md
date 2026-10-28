# Phase 3 real data integration

The owner expanded Phase 3 to integrate all existing planner screens, including work originally scheduled in later phases. The approved UI and Phase 2 authentication remain in place. Core pages query Supabase; they never substitute fixtures after a failed request. Legacy fixture modules remain for tests only.

## Implemented behavior

- Projects: membership-scoped catalog, creation, selection, editing and leader-only deletion through the existing RPC.
- Members: private display roster, registered-email invitations and removal through authorized RPCs. Project membership has no application-defined size limit.
- Sections and tasks: create, edit, delete, atomic section ordering, section moves, member assignment, status, priority, deadlines, filtering and sorting.
- Task details: optional ordered checklist steps and HTTP(S) resource links, with persistent mutations and confirmation before destructive actions.
- My Tasks: authenticated user's assignments across authorized projects, including project and section context. Selecting a project does not narrow this global list.
- Overview and deadline calendar: summaries and deadlines derived from authorized records.
- Availability: project-scoped free-time ranges, own-slot editing, overnight intervals and common-time exploration. Intervals are start-inclusive/end-exclusive. Inputs and displays use local time; PostgreSQL stores timestamp instants.
- Profile: actual signed-in identity and editable own display name. Authentication-managed email is read-only. No separate Settings screen or labels were added because the existing routes/schema do not support them.

Server data uses feature query modules and a small React request hook. Responses from an obsolete project/request are ignored. Successful mutations, explicit Refresh data and window focus refetch data; there are no realtime subscriptions. Membership revocation is reflected after refresh. Database RLS remains the authorization boundary. Zero-row writes are reported as unavailable/unauthorized rather than fake success.

## Apply the required migration manually

No migration was applied by this implementation. First confirm the intended disposable Supabase project and that Phase 2 is applied. Review and run the **entire** `supabase/migrations/20261026000100_phase_3_integration.sql` as postgres in SQL Editor, once, or apply it through your established migration process. Do not reapply the original Phase 2 migration.

The new transactional migration adds owner-approved `tasks.priority` values `low`, `normal` (default), `high` and adds the member-authorized `reorder_sections(uuid,uuid[])` RPC. It changes no RLS policy. Membership continues to use the unchanged Phase 2 leader-only RPCs, without a member cap. It requests a PostgREST schema reload. Missing-column/function errors in the app indicate this migration still needs applying.

Then optionally run the complete `supabase/tests/phase_3_integration.sql` on the disposable project. It uses transactional synthetic fixtures and rolls back. It covers the new priority, membership beyond five and ordering behavior, not a new Google-auth harness. It has **not** been executed here. Do not replace its ROLLBACK with COMMIT.

## Local verification and remaining acceptance

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test -- --run`, and `npm.cmd run build` (or `npm` outside PowerShell). Component tests mock the query boundary; they demonstrate UI behavior and error handling, not successful hosted persistence or RLS. Database TypeScript types are derived from the migrations rather than generated from a remote database; queries use scalar records rather than embedded relationship selects.

After applying the migration, exercise the existing UI with an authenticated session: create a project and sections; create/edit/move a task; change assignment/status/priority/deadline; edit steps/resources; add/edit/delete overnight availability; inspect calendars and summaries; refresh and confirm persistence. Check member actions and access-loss refresh using existing test accounts as needed. Delete only clearly identified test projects through the leader UI when finished. No remote requests or these acceptance checks were executed by the implementation agent. Existing Phase 2 success is owner-reported and does not verify the new migration.

Browser visual and keyboard review at 375px, 768px and 1440px remains a manual acceptance step. No deployment, commit, push, new dependency, privileged frontend credential or realtime infrastructure was introduced.
