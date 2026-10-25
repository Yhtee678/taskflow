# Phase 2 real-session API authorization harness

Status: **implemented locally; no real API test has been executed by the agent**. Local unit tests use synthetic responses and do not verify Supabase RLS. The owner reports that SQL-role tests and browser authentication/session checks have passed.

This temporary console harness lives in `src/dev/real-api-authorization.ts`. It is not imported by the application or router, adds no CRUD UI or dependencies, and has no production entry point. It refuses non-development execution, non-loopback browser origins and a backend URL that does not exactly match the independently supplied test-project reference. Importing the module sends no test requests. Explicit method calls send real requests using the existing Supabase singleton and its actual Google session.

**These HTTP requests commit real test records; unlike the SQL suite, they cannot be wrapped in a shared rollback transaction. Cleanup is an explicit final step.** Run only against disposable **taskflow-test**. The database URL cannot establish a Dashboard project's display name: independently copy the reference from that project's Dashboard and verify the project selection before starting.

## Prepare two real accounts

1. Use two distinct Google accounts and **two separate browser profiles**, or a regular profile plus an independent incognito session. Two ordinary tabs in one browser profile share Supabase session storage and are not two users. Sign in as A in one profile and B in the other through the normal application.
2. Both accounts must be registered on `taskflow-test`, with no existing project memberships. The baseline verifies a profile for the authenticated UID/email and zero memberships before creating anything. If an account has memberships, stop: that is a failed baseline prerequisite, **not proof of automatic enrollment**. Do not delete unrelated memberships. Use clean accounts or explicitly inspect/clean up a prior harness run. A newly registered Google account is required to establish the first-login provisioning behavior; with an existing account, the profile check proves presence only.
3. Ensure the local Vite process points at `taskflow-test`. The existing application accepts a **Publishable Key**, not privileged credentials. If `.env.local` points elsewhere, use temporary environment overrides in a dedicated PowerShell terminal rather than changing production configuration:

   ```powershell
   $env:VITE_SUPABASE_URL = 'https://YOUR_TEST_PROJECT_REF.supabase.co'
   $env:VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YOUR_TEST_KEY'
   npm.cmd run dev
   ```

   Restart/re-authenticate on the intended origin after changing the backend. After stopping that server, remove these temporary variables with `Remove-Item Env:VITE_SUPABASE_URL` and `Remove-Item Env:VITE_SUPABASE_PUBLISHABLE_KEY`, or close the dedicated terminal. Do not supply a service-role key, secret key, database password or Google client secret.

4. Open the app on `http://localhost:5173` in both profiles (adjust port if necessary). Open each profile's browser DevTools Console. Keep both profiles on their original account throughout the run; do not sign out/switch accounts or issue overlapping method calls. Each phase verifies the authenticated identity against Auth again and stops if the account changes.
5. Generate one run UUID in A's console with `crypto.randomUUID()`. Copy this **same run UUID** to B. Keep a local note of the UUID, actor labels and backend reference for recovery. This identifier is not a credential.

## Open the harness

In A's console, replace the placeholders; use a newly generated UUID, not the literal placeholder:

```js
var apiModule = await import('/src/dev/real-api-authorization.ts');
var runId = 'PASTE_SHARED_RUN_UUID';
var testRef = 'PASTE_TASKFLOW_TEST_PROJECT_REF';
var a = await apiModule.openAuthorizationHarness({
  runId,
  actor: 'A',
  expectedProjectRef: testRef,
});
await a.baseline();
await a.createFixtures();
JSON.stringify(a.descriptor());
```

In B's console:

```js
var apiModule = await import('/src/dev/real-api-authorization.ts');
var runId = 'PASTE_THE_SAME_RUN_UUID';
var testRef = 'PASTE_THE_SAME_TEST_PROJECT_REF';
var b = await apiModule.openAuthorizationHarness({
  runId,
  actor: 'B',
  expectedProjectRef: testRef,
});
await b.baseline();
await b.createFixtures();
JSON.stringify(b.descriptor());
```

Each descriptor contains **only** the run UUID, actor, project reference, user UUID/email, project UUID, section UUID and task UUID. Paste A's descriptor as an object into B's console (`var peerA = {...};`) and B's into A's (`var peerB = {...};`). Use the generated descriptors unchanged. Extra fields, wrong runs/backends, identical accounts and malformed IDs are rejected. These descriptors contain account email/IDs: share them only between your two test profiles, not publicly. Never paste a session object, token, browser storage dump, Authorization header or HAR file. The harness never reads, logs, serializes or manually stores access/refresh tokens; normal SDK-managed browser session persistence remains unchanged.

Fixture project names are `[TaskFlow Phase2 API] <run UUID> A` and `… B`. Each project has a disposable section, task assigned to its creator, step and resource. Project IDs come from the normal authenticated `create_project` RPC. The harness checks ownership/leader membership and positive fixture visibility; fake headers or claims are never used.

## Execute in this exact order

Wait for each call to complete. Every call returns its phase result; an exception means **stop** and inspect `report()` before cleanup. Do not continue after failure or reinterpret a denial as success. Start a fresh run after cleanup to retest.

| Order | Profile  | Call                              | Expected evidence                                                                                                                                                                                                                                                                 |
| ----- | -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | A        | `await a.checkIsolation(peerB)`   | B's project/children/profile are filtered; B's project/task UPDATE returns zero rows; INSERT/self-join/leader RPC attempts receive authenticated permission errors                                                                                                                |
| 2     | B        | `await b.checkIsolation(peerA)`   | Symmetric restrictions against A                                                                                                                                                                                                                                                  |
| 3     | A        | `await a.addMember(peerB)`        | A verifies its fixtures survived negative probes, then adds B to A as `member` through the leader RPC                                                                                                                                                                             |
| 4     | B        | `await b.exerciseMember(peerA)`   | B can read A, read only minimal teammate names, and edit A's task while it is assigned to A; B still cannot promote itself, manage membership, delete A, edit A's profile, or overwrite its own Auth-managed email. B also verifies its own fixtures survived A's negative probes |
| 5     | A        | `await a.verifyMemberEdit(peerB)` | A independently reads the guidance edit made through B's session; assignee remains A                                                                                                                                                                                              |
| 6     | A        | `await a.removeMember(peerB)`     | Assigns the disposable task to B, removes B, verifies membership removal, task unassignment and roster exclusion                                                                                                                                                                  |
| 7     | B        | `await b.checkRevocation(peerA)`  | With B still signed in, A's project/task disappear, UPDATE returns zero rows, INSERT/roster requests are denied; B still sees its own project                                                                                                                                     |
| 8     | Both     | `a.report()` / `b.report()`       | All listed phases passed; only cleanup should be missing. Reports identify actual HTTP status, SQLSTATE/API code and row counts without response bodies                                                                                                                           |
| 9     | A then B | Cleanup below                     | Deletes only each actor's owned test-run project                                                                                                                                                                                                                                  |

**Do not clean up A's project before B checks revocation**: a deleted target cannot establish that member removal revoked access to an existing project. The two-profile sequence and both reports are necessary; A's report alone does not attest to B's checks, and vice versa. This is coordinated manual integration testing, not a distributed automatic runner.

## Interpret results correctly

| Observed response                                                                         | Harness interpretation                                                                 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 2xx, `error: null`, `data: []` on a negative SELECT/UPDATE with `.select()`               | Expected RLS filtering / zero affected returned rows; **not an HTTP permission error** |
| HTTP 403 and PostgreSQL code `42501` on a forbidden INSERT/RPC/direct membership mutation | Expected authenticated permission denial                                               |
| HTTP 401, transport status 0, missing RPC/schema, other error codes, FK/validation errors | Failure/setup problem; never accepted as proof of authorization                        |
| 2xx positive operation but wrong/missing IDs, owner, role or expected values              | Failure, not success merely because HTTP returned 200                                  |

All negative UPDATE probes request returned IDs with `.select()`; a bare successful mutation response would not establish zero affected rows. Positive owner controls, exact run markers and a known peer fixture avoid treating an arbitrary nonexistent UUID as isolation evidence. The owner checks for unintended negative-probe changes before proceeding. All reports remain in memory, with no raw SDK response/error objects, keys or credentials in them. `report().complete` becomes true only after that actor's required steps and cleanup finish without a failure. A prior failure stays recorded even if cleanup succeeds.

Profile write-denial probes submit the existing display name from the authorized minimal roster, or the caller's existing email. They still require the expected denial but avoid replacing account profile values if a policy is incorrectly permissive.

The harness does not print exceptions from the SDK or database; its own errors contain safe step names. Browser developer tools can independently expose request headers—do not export those headers or network traces as evidence. Record only the sanitized reports and expected account labels/project reference.

## Cleanup and recovery

After **both** accounts finish revocation verification:

```js
// A's console
await a.cleanupOwnRun();
a.report();
// B's console
await b.cleanupOwnRun();
b.report();
```

Each caller searches only for the **exact run-and-actor project name**, verifies `created_by` equals its server-verified UID and its membership is `leader`, validates the fixture description (original marker or this run's negative probe), then calls `delete_project` for that ID. It never accepts a peer ID for cleanup or deletes all projects by a broad prefix. The RPC cascades test children. It checks that no matching owned run project remains visible. These API checks do not independently inspect physically cascaded rows after membership disappears; the SQL suite covers that part.

If setup or a test fails, the only permitted next harness action is cleanup. Cleanup can be retried and handles a lost `create_project` response by discovering the exact owned run marker; do not automatically retry project creation. If a negative write unexpectedly succeeds, stop—some fixture content/membership may have changed. Each original leader should clean up its own run project. A deletion/membership failure may require manual inspection by the test-project owner; do not weaken RLS or use privileged credentials in the harness.

If a page refresh loses the in-memory harness, sign in as the **original actor**, import/open it again with the same run UUID, actor and test-project reference, then call `cleanupOwnRun()` directly. You do not need a baseline or fixture descriptor for recovery cleanup. A new harness cannot reconstruct the lost verification report; rerun verification under a new UUID after cleanup. No account/profile is deleted, no real Auth email/display name is intentionally changed, and unrelated projects/memberships are not cleaned up. Verify both actors completed cleanup before another baseline run.

The exact project marker/ownership checks intentionally stop on unexplained mismatches. Keep the run UUID and any generated project IDs in your private test notes until cleanup succeeds. Do not manually delete projects just because their name looks similar.

## Local verification and limits

`src/test/api-authorization-harness.test.ts` tests response classification, sanitized evidence, descriptor boundaries, production/backend guards and import inactivity with a mocked client. These are **local safeguard tests**, not real-session RLS evidence. Nothing runs the remote harness from `npm test`, `build`, page rendering or import. No route, application data integration, migration, policy or production configuration is changed.

Local verification performed: TypeScript and lint passed, all 56 local tests passed (including 11 harness safeguard cases), production build passed with the existing bundle-size warning, targeted formatting and diff checks passed, and the built JavaScript contained none of the harness entry/fixture/cleanup markers. The migration's SHA256 was unchanged. **No real-user API tests or remote cleanup were run.**

The development source is not imported into the production graph; runtime guards provide an additional refusal. Do not link it from application pages. To remove the temporary harness later, delete its two `src/dev` files, its dedicated local test and this document; no app routing changes need undoing.

The workflow does not cover anonymous requests, availability ownership, concurrent edits/removal, every child-table write, expired-JWT behavior or Google OAuth itself; existing SQL/browser checks cover separate areas. SDK-managed sessions are used directly, so this does exercise signed-session Data API/RPC requests that SQL role impersonation does not. It targets the configured disposable backend only; it does not verify another Supabase project's schema/policies. A two-account run cannot verify every possible role combination.

References: [Supabase UPDATE with returned rows](https://supabase.com/docs/reference/javascript/update), [empty SELECT results and RLS](https://supabase.com/kb/troubleshooting/why-is-my-select-returning-an-empty-data-array-and-i-have-data-in-the-table-xvOPgx), [RLS security boundary](https://supabase.com/docs/guides/database/postgres/row-level-security).
