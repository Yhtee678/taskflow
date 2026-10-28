# Phase 2 — Supabase foundation and Google authentication

Local implementation is prepared. No hosted database migration or provider configuration is performed by the application or by this change. Phase 2's acceptance gate remains pending until the database authorization suite and real Google login journey pass.

## Browser configuration

Install dependencies with `npm install` (`npm.cmd install` on restricted PowerShell). Copy `.env.example` to `.env.local`, then set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

Replace both placeholders with your project's URL and **Publishable Key** from Supabase settings. Restart Vite after editing environment values. `.env.local` is ignored by Git. The client rejects missing/placeholder values, invalid URLs, nonlocal HTTP URLs, and non-publishable keys; errors name the expected variables without printing their values. Legacy anon JWT keys are not accepted by this configuration: use the project's current publishable key.

Every `VITE_*` value is public in browser builds. Never place a Supabase secret/service-role key, database connection string/password, or Google OAuth client secret in these variables. This code reads only the two variables above and does not read or modify `.env.local`.

## Google and redirect setup (owner action)

1. In Google Cloud, configure the OAuth consent screen and a Web application OAuth client. If the consent app is in testing, allow the Google accounts used for verification.
2. Enable Google in Supabase Authentication providers and enter the Google client ID and secret **there**, never in the frontend.
3. In Google's OAuth client, use the exact callback URL shown by Supabase (normally `https://YOUR_PROJECT.supabase.co/auth/v1/callback`) as an authorized redirect URI. Google's redirect is to Supabase, not directly to Vite.
4. In Supabase Authentication URL configuration, set **Site URL** to the deployed HTTPS application origin for production. Add its exact `/auth/callback` URL to **Redirect URLs**, plus each supported staging/preview callback. Retain `http://localhost:5173/auth/callback` for development (and the exact callback for any other local origin/port you use). A local-only Supabase project can use `http://localhost:5173` as its Site URL. Avoid broad production wildcards. See [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).
5. Run `npm run dev` and open the matching local origin. After Google completes, Supabase redirects to `/auth/callback`; the SDK detects the URL and exchanges the PKCE code. The callback page waits for SDK initialization, then redirects to `/my-tasks`. A missing/expired/cancelled callback shows a retry/sign-in path rather than looping.

One singleton Supabase browser client owns PKCE, persistence, token refresh and URL detection. The app does not manually store, exchange or parse tokens. The auth provider subscribes with a synchronous callback, restores the session, ignores stale restore results, and unsubscribes on unmount. `/login` redirects signed-in users to My Tasks. Application routes wait for initialization and redirect signed-out users to Sign In. Sign out uses SDK `scope: 'local'` to end this browser's session; it does not sign the user out of other devices. Errors keep a retry path. Supabase session events also remove protected UI when another tab signs out or a session is lost.

The frontend already derives OAuth `redirectTo` from `window.location.origin` plus `/auth/callback`; no hardcoded application hostname or additional app-URL variable is needed. Login, callback success and sign-out use relative routes. Hosting must serve the SPA entry point for direct `/auth/callback` requests. Configure the existing two Supabase Vite variables in the deployment build environment. Verify login, refresh and sign-out on the actual deployed origin after configuring the allowlist; mocked tests cannot verify hosted settings. The localhost checks in Supabase URL validation and the development-only API harness are intentional local-development safeguards, not redirect destinations.

## Apply the migration (explicit owner action)

Review `supabase/migrations/20261025000100_phase_2_foundation.sql` before running it. The original unapplied migration has been refined directly. It is intended for a new Supabase application schema, not as an idempotent repair script for pre-existing tables. Do not reset a hosted database or rerun an already applied migration. If those table/function names already exist, inspect the schema and prepare a separate reviewed migration. The migration fails early unless its effective database role is `postgres`, establishing deterministic trusted ownership of all tables and definer functions; do not run it as a browser/runtime role.

Preferred verification order:

1. Use a disposable Supabase development/test project with no valuable application data.
2. Run the migration as the database owner using the Supabase SQL Editor, or use a trusted `psql` installation. The SQL is transaction-wrapped, so a failed migration rolls back.
3. Run the authorization suite against that test database. It creates three synthetic Auth users, two projects and test children inside a transaction, switches to `anon`/`authenticated` roles, and rolls back every fixture. It must start as `postgres` to create those test users and assume roles. An invoker-only helper sets transaction-local `request.jwt.claims` with `sub` and `role`, clears historical scalar claims, and asserts that `auth.uid()` resolves to the intended identity. One additional check verifies the legacy scalar subject setting. Assertions verify the runtime roles have no superuser/BYPASSRLS rights. These are database test identities, not usable Google credentials or signed JWTs; API JWT validation is a separate check.

```powershell
# Supply this variable securely outside Vite; do not paste credentials into Git.
# TEST_DATABASE_URL must point at the disposable test database, not production.
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261025000100_phase_2_foundation.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_2_authorization.sql
```

The test script can also be run as a complete script in the test project's SQL Editor after applying the migration. Expect the final PASS result and transaction rollback; any raised exception is a failure. A failed script with `ON_ERROR_STOP=1` exits nonzero and closing the connection rolls back the open transaction. Never use a browser publishable key as a database-owner credential. Record successful application in your normal migration history; do not also push the same migration through a second mechanism without reconciling migration history.

Only after test results and review should the owner apply the same migration to the intended hosted project. No remote SQL is executed automatically by npm, Vite, login, or tests. The migration provisions profiles for existing Auth users and installs an Auth trigger for new users/email changes. It creates no project memberships for existing users.

## Database behavior

- Eight application tables have RLS and explicit authenticated grants. Anonymous roles have no application table or RPC privileges.
- Profiles are self-readable, with client updates limited to `display_name`. ID/email are Auth-managed. Profile provisioning upserts through a pinned-search-path trigger; user metadata supplies display text only. `get_project_member_display(p_project_id)` returns only `user_id` and `display_name` for that project's current members, after checking the caller's identity and live membership. It includes the caller but never returns emails, creation timestamps, Auth metadata or other project memberships. Unknown, null and unauthorized project IDs receive the same permission error. There is no global directory or user-search parameter. Members/Assignee UI can use this RPC in a later phase; no frontend changes are part of the SQL review.
- Projects have one creator/leader. Client project creation, membership insert/update/delete, creator updates and direct project deletion are denied by grants. Four authenticated-only RPCs implement atomic creation, leader-only exact-email member addition, removal and project deletion. RPCs obtain the actor from `auth.uid()`, validate authorization and pin `search_path = ''`.
- Membership helpers live in unexposed `private`; keep this schema out of Supabase's exposed schemas. Helpers bypass recursive membership policies but return only whether the caller belongs to/leads the specified project.
- Members can edit all project sections, tasks, steps and resources, including others' assigned tasks. Composite foreign keys prevent cross-project sections, tasks and assignees. Status, text, ordering, HTTP(S) URL and time-range constraints reject invalid records.
- Availability slots are **available/free time**, as already specified in the requirements and frontend fixtures. Each range is `[starts_at, ends_at)` (inclusive start, exclusive end); missing data is unknown, not a busy-time record. Midnight-crossing intervals are valid when end is after start. SQL table/column comments record this contract; no flag or extra field is added. Availability is project-scoped and readable by members. Both old-row and new-row policies restrict writes to the slot owner. A leader cannot edit another person's slots.
- Removal locks the membership, unassigns tasks, deletes availability, then deletes membership atomically. Leaders cannot remove themselves or transfer leadership. Project deletion clears assignment references before cascading project children. Deleting non-empty sections cascades tasks and their children; future UI must confirm this destructive action.
- Creator/account references intentionally restrict account deletion while owned projects or memberships exist. Account deletion is not an app feature; administrative cleanup must use the reviewed project/member lifecycle first.
- No service-role code, auth tokens in application tables, realtime, notification delivery or backend server is added.

## UI boundary

The signed-in name and account state are real Supabase Auth data. Project, task, member, calendar and availability content remain the original fictional fixtures for Alex Tan, clearly identified by the banner. Fixture roles and selectors do not confer database permissions. The UI does not query real project data yet. Sign-out unmounts the protected shell and clears temporary checklist/filter/project selection state; a different signed-in user also gets a fresh shell. Database RPCs are prepared but have no Phase 3 management UI.

## Verification

Run:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run format:check
```

Frontend tests mock the SDK; they cover restored/absent/loading sessions, redirects, OAuth request arguments and errors, sign-out success/failure, session events, stale restore races, configuration validation, callbacks and existing route behavior. These tests are not evidence of working Google credentials, provider redirects, database migrations, or RLS.

Initial Phase 2 frontend results: dependency installation completed and reported zero vulnerabilities; TypeScript and lint passed; 45 frontend/configuration tests passed; production build passed; formatting and diff checks passed. Tests/build required a rerun outside the sandbox because it blocked Vite child processes (`spawn EPERM`). The build reports a non-fatal chunk warning (about 593kB minified / 173kB gzip for the main bundle after adding the SDK). No code splitting or unrelated build changes were added.

The subsequent SQL-only review refined the same unapplied migration, SQL tests, this document and the architecture notes. TypeScript, lint, formatting, diff checks and all 45 frontend regression tests were rerun successfully; frontend behavior and dependencies were unchanged, so the production build was not repeated. SQL compatibility has been reviewed against Supabase/PostgreSQL guidance but not executed against a database. SQL-test changes include resolving temporary namespace names for grants, explicit invoker-only test helpers, modern JWT claim objects with identity assertions, and exact catalog checks that cannot pass merely because a definer function is missing. Leader mutation RPCs now reject unauthorized callers before acquiring project locks and recheck authorization after acquiring the lock.

The SQL migration and SQL suite have **not** been executed: neither `psql` nor the Supabase CLI was available on PATH, and no remote database was modified. Real Google OAuth, provider configuration and browser visual/keyboard journeys are still manual checks. RLS is **not verified**, and Phase 2's security exit gate is not passed.

The SQL suite covers table RLS flags, anonymous access, project isolation, private profiles, teammate display projection/field minimization, unrelated users connected through a shared teammate, teammate editing, cross-project foreign keys, malicious resource schemes, availability ownership (including leaders), overnight free time, direct membership escalation, leader RPC authorization, last-leader preservation, atomic removal, revoked roster access and cascades. Catalog checks verify all eight exact application function signatures, trusted owner, SECURITY DEFINER status, pinned empty search paths, absence of PUBLIC/anon execute rights and the authenticated execute allowlist (including no direct access to the profile trigger). Caller-controlled search paths and shadow temporary membership/profile tables test that helpers and the roster RPC use qualified real relations. Temporary test-function grants resolve the actual temporary namespace name for GRANT compatibility; the test helpers are SECURITY INVOKER and cannot bypass RLS. It must actually pass on a Supabase database before RLS can be called verified.

Outstanding manual checks:

1. Apply and run the SQL on a clean disposable Supabase database; record actual results and review RPC/search-path/grant behavior, including concurrent task assignment and member removal.
2. Configure Google and allowlisted URLs; verify sign-in, consent cancellation, refresh restoration, expired callback, sign out, browser Back, reload after logout, cross-tab logout and a second account.
3. Confirm profiles are provisioned without project membership; email updates stay Auth-managed.
4. Use two real Google accounts with separate project memberships to check isolation through the Data API, not only SQL role impersonation. Do not log JWTs or credentials.
5. Generate Supabase database types after applying the reviewed schema (`supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/types/database.ts`) before adding typed domain queries in Phase 3. No generated types are fabricated in this phase; the current SDK usage is auth-only.

References: [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [browser PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [Auth profile triggers](https://supabase.com/docs/guides/auth/managing-user-data).
