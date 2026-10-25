# Phase 2 verification in Supabase SQL Editor

Status: **corrected revision not executed**. The owner reports that the migration was applied to disposable `taskflow-test` and the previous editor script failed with SQLSTATE `3F000` (helper schema missing). No successful database test result is recorded.

Use [`phase_2_sql_editor.sql`](phase_2_sql_editor.sql) for Dashboard execution. The original `phase_2_authorization.sql` remains unchanged. The new script is standalone: no CLI, direct database connection, pgTAP extension, project keys or Google credentials are required.

## Run it

1. Open the Supabase Dashboard and manually confirm the selected project is **taskflow-test**, the disposable test project. The SQL cannot reliably determine the Dashboard project name.
2. Open **SQL Editor**, create a new query and select the **postgres** database role. Use an account authorized to create transaction-scoped test objects, insert synthetic Auth users and assume `anon`/`authenticated`. Do not choose a Table Editor/API user impersonation mode as the starting role.
3. Replace the old query buffer **completely** with `phase_2_sql_editor.sql`, including removing any automatically appended `-- Added by Supabase` / `ALTER TABLE` tail. Clear text selections so **Run** executes the whole file, from `BEGIN` through `ROLLBACK` and the final cleanup query. Use **Run**, not Explain; select **No limit** and disable user/role impersonation. Do not run sections in separate requests: role settings, fixtures and helper objects share one transaction/connection.
4. If Dashboard displays a confirmation for DDL or fixture writes, review that the selected project is `taskflow-test` and that the script ends the test transaction with `ROLLBACK`. Do not accept an action that appends RLS fixes after rollback; the corrected file explicitly enables RLS on all three harness tables. The script never applies a migration or changes application policies/functions/grants.
5. Run once. Any SQL error, timeout, unexpected SQLSTATE or failed assertion means the run **did not pass**. Save the first error and its context. The final summary query (before rollback) reports successful checks and expected denials grouped by effective database role. The last result should say `ROLLBACK CONFIRMED`. Some editor versions show only the last result; retain the complete no-error execution result and inspect additional result sets/messages if exposed. Do not remove rollback to keep the assertion table.
6. If the editor reports an aborted transaction after a failure, issue `ROLLBACK;` as a separate cleanup query before rerunning the **whole** script. A failed transaction cannot commit fixture writes. Do not replace rollback with commit or manually delete pre-existing records to bypass a preflight error.

The helper schema is created inside the test transaction and rolled back, alongside synthetic Auth users, profiles, projects, memberships, sections, tasks, steps, resources, availability and test-only grants. The final read-only check verifies the helper schema and fixture Auth user IDs are absent after rollback. Reserved fixture IDs/emails or an existing helper schema cause an early failure instead of overwriting data. Every complete successful run can be repeated. Never accept a cleanup-only result, a successful subset, or “Success. No rows returned” alone as proof of RLS success.

## Why schema 3F000 can occur

The checked-in script creates the schema before every helper invocation. All helper function calls, result-table reads and harness grants occur before the one `ROLLBACK`. The only references afterward are a schema-name string passed to `to_regnamespace` (which returns NULL for a missing schema) and reads from `auth.users`; they do not invoke a deleted helper. A correctly submitted unmodified batch does not require the harness schema after rollback.

The SQL Editor's published implementation detects `CREATE TABLE` without matching RLS enables. Its `appendEnableRLSStatements` action can append, for example:

```sql
-- Added by Supabase: enable Row Level Security on newly created tables
ALTER TABLE taskflow_rls_editor_test.results ENABLE ROW LEVEL SECURITY;
```

If appended after this script, that exact statement references a schema already removed by rollback and produces `3F000`. The old script created three harness tables without explicit RLS, making it eligible for this action. The correction enables RLS and adds narrowly scoped harness-only policies **before rollback**. This prevents the missing-RLS analyzer from flagging those tables and preserves the runtime harness privileges needed by the original assertions. Application RLS/grants/assertions remain unchanged.

This is a source-supported explanation for the reported error, not a remote reproduction or proof of the exact submitted query. Another possible cause is executing a selection starting at `REVOKE ALL ON SCHEMA taskflow_rls_editor_test ...`, a helper `CREATE FUNCTION`/call, or a helper table query without the preceding `CREATE SCHEMA` in the same transaction. If the corrected whole file still fails, retain the error's LINE/POSITION/CONTEXT and the actual submitted query from browser Network request details (redact connection headers/credentials). These distinguish an appended command, partial selection, or another failure without guessing.

The editor does **not** inherently execute every semicolon as a separate transaction. Its execution path submits the query text to pg-meta; the published pg-meta implementation passes that text to one database query call. PostgreSQL keeps the explicit `BEGIN` block open through `ROLLBACK`; statements afterward run in a new implicit transaction. Separate Run clicks are separate requests and must not be used to carry test state. Hosted implementations may differ; no remote request was inspected here.

Sources: [editor query selection and RLS append action](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/SQLEditor/SQLEditor.utils.ts), [editor execution request](https://github.com/supabase/supabase/blob/master/apps/studio/data/sql/execute-sql-mutation.ts), [pg-meta database query execution](https://github.com/supabase/postgres-meta/blob/master/src/lib/db.ts), [PostgreSQL multi-statement transaction behavior](https://www.postgresql.org/docs/17/protocol-flow.html).

## What the script checks

- Anonymous table/RPC restrictions across all eight application tables.
- Project isolation for three identities, including a person belonging to both projects.
- Atomic project creation, creator leadership, leader-only membership/deletion RPCs and last-leader preservation.
- Teammate task/step/resource editing, with cross-project assignment and parent-ID constraint rejection.
- Direct membership, creator, profile-email and role escalation prevention.
- Self-only profile rows, minimal teammate display projection, unrelated-user isolation and loss of roster access after removal.
- Project-scoped free-time visibility, owner-only writes, leader restrictions, valid overnight ranges and invalid time-range rejection.
- Removal unassigning tasks/deleting availability/revoking access, and project deletion cascades.
- Actual effective `anon`/`authenticated` roles without superuser/BYPASSRLS rights, and claim settings resolving to the intended `auth.uid()`, `auth.role()` and `auth.jwt()` role.
- All eight expected application functions: trusted `postgres` ownership, SECURITY DEFINER, pinned empty search paths and explicit execute allowlists. Caller-controlled decoy tables verify schema-qualified relation lookup.

The editor starts with owner privileges for setup and catalog inspection. Application access assertions explicitly use `SET LOCAL ROLE anon` or `authenticated`; changing JSON claims alone is not treated as role switching. Transaction-local JWT claims are simulated, with historical scalar settings cleared before each modern identity change. A separate legacy-subject compatibility check is retained from the original suite. The script restores `postgres` explicitly instead of assuming `RESET ROLE` returns the editor's selected starting role.

Test helpers use **SECURITY INVOKER** in a dedicated, rollback-scoped schema. Runtime roles receive only usage/execute and result-insert/decoy-table privileges in that schema, never new application privileges. This avoids relying on cross-role grants to a session-temporary schema. No helper schema should be added to the exposed API schemas.

Harness tables also have RLS enabled: `anon`/`authenticated` can insert assertion results, and `authenticated` can read/insert decoy rows under explicit test-only policies and existing grants. Only the owner reads the result summary. These policies roll back with the harness and do not widen application permissions.

## Limits and remaining verification

This script was reviewed and checked locally as a file, **not executed against PostgreSQL or Supabase**. SQL Editor compatibility and RLS remain pending until a complete successful execution on `taskflow-test`. The database enforces assertions at execution time; the script itself cannot establish a pass merely by being present in the repository.

Claim simulation tests database authorization **after** JWT verification. It does not test JWT signatures, Google OAuth, SDK refresh/sign-out, API schema exposure, PostgREST behavior, browser navigation or concurrent assignment/removal races. Complete those separately with real signed-in accounts and authorized test tooling. Additional custom Auth/database triggers could affect fixture insertion; report those errors rather than weakening checks. Transaction rollback cannot undo out-of-database side effects from unrelated custom synchronous integrations.

Local preparation checks do not establish database success. Record the project, execution date, complete no-error result, assertion summary if available, and rollback confirmation only after running the whole script successfully.

Reference: Supabase documents [SQL Editor RLS testing with role switching](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database testing](https://supabase.com/docs/guides/local-development/testing/overview).
