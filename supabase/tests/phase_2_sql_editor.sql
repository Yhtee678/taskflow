-- TaskFlow Phase 2 - Supabase Dashboard SQL Editor verification.
-- Previous revision reported 3F000; this corrected revision is NOT EXECUTED.
-- Target: the disposable taskflow-test project with the refined Phase 2 migration
-- already applied. The database cannot reliably infer the Dashboard project name:
-- manually confirm taskflow-test in the project selector BEFORE running.
--
-- RUN: SQL Editor > New query > database role postgres > paste this ENTIRE file
-- > clear any text selection > Run. Do not run individual sections. No psql, CLI,
-- connection string, pgTAP extension, or real Google user/token is required.
-- If Dashboard flags fixture INSERT/UPDATE/DELETE/DDL, review the selected project
-- and whole-script ROLLBACK before you choose to proceed.
-- All helper tables explicitly enable RLS below. Do not let the editor append
-- automatic ALTER TABLE / RLS fixes AFTER rollback: that schema is gone then.
-- Replace an old editor buffer completely, including any "Added by Supabase"
-- tail. Use Run (not Explain), postgres without user impersonation, and No limit.
--
-- Expected outcome: no SQL error, a PASS assertion summary before ROLLBACK, and
-- a final ROLLBACK CONFIRMED result. Every helper, grant, decoy, Auth fixture and
-- application fixture is transactional. DO NOT change ROLLBACK to COMMIT.
-- If a statement fails, the transaction is aborted (no writes can commit).
-- Stop, save the FIRST error, and run ROLLBACK; as a separate cleanup query if
-- the editor still reports an aborted transaction. Then fix/re-run the WHOLE file.
-- A successful subset, cleanup result alone, or 'Success. No rows returned' is
-- NOT sufficient evidence. If result sets are hidden, inspect Results/Messages
-- for the summary; do not remove the rollback to expose a result table.
--
-- This simulates claims after JWT verification; it does not validate signatures,
-- Google OAuth, PostgREST exposure, concurrent transactions, or browser sessions.
-- Owner-only setup/catalog checks are separate from actual runtime-role RLS
-- assertions. No application policy, grant or function definition is changed.

begin;
set local row_security = on;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Test setup and fixtures require the trusted owner; assertions later explicitly
-- switch to roles without RLS bypass. This suite is not a signed-JWT/API test.
do $$ begin
  if current_user <> 'postgres' then raise exception 'Select the postgres role in SQL Editor, then run the WHOLE script on taskflow-test'; end if;
  if to_regprocedure('public.get_project_member_display(uuid)') is null then
    raise exception 'The refined Phase 2 migration (including the teammate-display RPC) must already be applied';
  end if;
  if to_regnamespace('taskflow_rls_editor_test') is not null then
    raise exception 'Test schema already exists. Stop and inspect it; this script never deletes pre-existing objects';
  end if;
  if exists (select 1 from auth.users where id in ('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid) or lower(email) in ('taskflow-alpha@example.test','taskflow-beta@example.test','taskflow-beta-updated@example.test','taskflow-gamma@example.test','not-registered@example.test')) then
    raise exception 'Reserved fixture ID/email already exists. Stop; no existing users will be overwritten or deleted';
  end if;
end; $$;

-- Named schema avoids session-temporary-function/ACL assumptions in Dashboard.
-- CREATE SCHEMA has no IF NOT EXISTS: never reuse someone else's test objects.
create schema taskflow_rls_editor_test authorization postgres;
revoke all on schema taskflow_rls_editor_test from public, anon, authenticated;
grant usage on schema taskflow_rls_editor_test to anon, authenticated;
create table taskflow_rls_editor_test.results (check_name text not null, checked_as text not null, claimed_user uuid, expected_sqlstate text);
-- Keep the editor's CREATE TABLE/RLS analyzer from appending fixes after rollback.
-- These policies affect only transactional harness tables, never public app data.
alter table taskflow_rls_editor_test.results enable row level security;
create policy results_insert on taskflow_rls_editor_test.results for insert to anon, authenticated with check (true);
revoke all on taskflow_rls_editor_test.results from public, anon, authenticated;
grant insert on taskflow_rls_editor_test.results to anon, authenticated;

create function taskflow_rls_editor_test.assert_true(p_value boolean, p_message text) returns void
language plpgsql security invoker set search_path = '' as $$ begin
  if p_value is distinct from true then raise exception 'FAIL [% / uid=%]: %', current_user, auth.uid(), p_message; end if;
  insert into taskflow_rls_editor_test.results(check_name, checked_as, claimed_user) values(p_message,current_user,auth.uid());
end; $$;

-- Decoys in a caller-controlled schema exercise qualified relation lookup.
create table taskflow_rls_editor_test.project_members (project_id uuid, user_id uuid, role text);
create table taskflow_rls_editor_test.profiles (id uuid, display_name text, email text);
alter table taskflow_rls_editor_test.project_members enable row level security;
alter table taskflow_rls_editor_test.profiles enable row level security;
create policy decoy_read on taskflow_rls_editor_test.project_members for select to authenticated using (true);
create policy decoy_insert on taskflow_rls_editor_test.project_members for insert to authenticated with check (true);
create policy decoy_read on taskflow_rls_editor_test.profiles for select to authenticated using (true);
create policy decoy_insert on taskflow_rls_editor_test.profiles for insert to authenticated with check (true);
grant select, insert on taskflow_rls_editor_test.project_members, taskflow_rls_editor_test.profiles to authenticated;
set local search_path = taskflow_rls_editor_test, public, private;
create function taskflow_rls_editor_test.expect_error(p_sql text, p_state text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_state text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state = p_state then
      insert into taskflow_rls_editor_test.results(check_name,checked_as,claimed_user,expected_sqlstate) values(p_sql,current_user,auth.uid(),p_state);
      return;
    end if;
    raise exception 'Expected SQLSTATE %, got % for %', p_state, v_state, p_sql;
  end;
  raise exception 'Expected SQLSTATE %, but statement succeeded: %', p_state, p_sql;
end; $$;
-- Use the modern PostgREST claim object; clear legacy settings so stale claims
-- cannot silently make an access assertion run as the wrong identity.
create function taskflow_rls_editor_test.set_identity(p_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', p_user_id, 'role', current_user)::text, true);
  perform taskflow_rls_editor_test.assert_true(auth.uid() is not distinct from p_user_id, 'JWT simulation must resolve the intended auth.uid()');
  perform taskflow_rls_editor_test.assert_true(current_user in ('anon','authenticated') and auth.role() = current_user::text and auth.jwt()->>'role' = current_user::text, 'JWT role and effective runtime SQL role agree');
end; $$;
-- Helpers are invokers. These grants do not give runtime roles access to
-- application data or ownership rights; all new objects roll back below.
revoke all on function taskflow_rls_editor_test.assert_true(boolean, text), taskflow_rls_editor_test.expect_error(text, text), taskflow_rls_editor_test.set_identity(uuid) from public, anon, authenticated;
grant execute on function taskflow_rls_editor_test.assert_true(boolean, text), taskflow_rls_editor_test.expect_error(text, text), taskflow_rls_editor_test.set_identity(uuid) to anon, authenticated;

select taskflow_rls_editor_test.assert_true((select count(*)=3 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='taskflow_rls_editor_test' and c.relname in ('results','project_members','profiles')), 'All harness tables explicitly enable RLS before tests run');

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','taskflow-alpha@example.test',now(),'{"full_name":"Alpha"}'),
 ('10000000-0000-0000-0000-000000000002','taskflow-beta@example.test',now(),'{"full_name":"Beta","role":"leader"}'),
 ('10000000-0000-0000-0000-000000000003','taskflow-gamma@example.test',now(),'{"full_name":"Gamma"}');

select taskflow_rls_editor_test.assert_true((select count(*) = 8 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','projects','project_members','sections','tasks','task_steps','task_resources','availability_slots') and c.relrowsecurity), 'RLS enabled on all eight tables');
select taskflow_rls_editor_test.assert_true((select count(*)=8 and bool_and(pg_get_userbyid(c.relowner)='postgres') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','projects','project_members','sections','tasks','task_steps','task_resources','availability_slots')), 'Application tables have trusted postgres ownership');
select taskflow_rls_editor_test.assert_true((select count(*)=3 from public.profiles where email like 'taskflow-%@example.test'), 'Auth trigger provisions profiles');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.project_members where user_id='10000000-0000-0000-0000-000000000002'), 'Untrusted metadata grants no membership');
update auth.users set email='taskflow-beta-updated@example.test' where id='10000000-0000-0000-0000-000000000002';
select taskflow_rls_editor_test.assert_true((select email='taskflow-beta-updated@example.test' from public.profiles where id='10000000-0000-0000-0000-000000000002'), 'Auth email changes synchronize profiles');
update auth.users set email='taskflow-beta@example.test' where id='10000000-0000-0000-0000-000000000002';

set local role anon;
select taskflow_rls_editor_test.set_identity(null);
select taskflow_rls_editor_test.assert_true(current_user = 'anon' and not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user), 'Anonymous assertions run without owner/BYPASSRLS rights');
do $$ declare t text; begin
  foreach t in array array['profiles','projects','project_members','sections','tasks','task_steps','task_resources','availability_slots'] loop
    perform taskflow_rls_editor_test.expect_error(format('select * from public.%I', t), '42501');
  end loop;
end; $$;
select taskflow_rls_editor_test.expect_error('select * from public.profiles', '42501');
select taskflow_rls_editor_test.expect_error('select * from public.projects', '42501');
select taskflow_rls_editor_test.expect_error('select * from public.tasks', '42501');
select taskflow_rls_editor_test.expect_error('select public.create_project(''Anonymous'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(''00000000-0000-0000-0000-000000000000'')', '42501');
select taskflow_rls_editor_test.expect_error('select private.is_project_member(''00000000-0000-0000-0000-000000000000'')', '42501');
set local role postgres;
set local role authenticated;
select taskflow_rls_editor_test.assert_true(current_user = 'authenticated' and not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user), 'Authenticated assertions run without owner/BYPASSRLS rights');
select taskflow_rls_editor_test.set_identity(null);
-- Current Supabase auth.uid() also supports the historical scalar setting.
-- Test it once, then return all subsequent checks to modern JSON claims.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select taskflow_rls_editor_test.assert_true(auth.uid()='10000000-0000-0000-0000-000000000001'::uuid, 'Legacy scalar subject is recognized');
select taskflow_rls_editor_test.set_identity(null);
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(null)', '42501');
select taskflow_rls_editor_test.expect_error('select public.create_project(''Missing identity'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.add_project_member_by_email(''00000000-0000-0000-0000-000000000000'',''taskflow-beta@example.test'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.remove_project_member(''00000000-0000-0000-0000-000000000000'',''10000000-0000-0000-0000-000000000002'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.delete_project(''00000000-0000-0000-0000-000000000000'')', '42501');
select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000001');
select set_config('taskflow_test.project_a', public.create_project('Test A')::text, true);
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.project_members where project_id=current_setting('taskflow_test.project_a')::uuid and role='leader' and user_id=auth.uid()), 'Creator is leader atomically');
select taskflow_rls_editor_test.expect_error('select public.create_project(''   '')', '23514');
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.projects), 'Invalid project creation leaves no partial row');
select public.add_project_member_by_email(current_setting('taskflow_test.project_a')::uuid, ' TASKFLOW-BETA@EXAMPLE.TEST ');
select public.add_project_member_by_email(current_setting('taskflow_test.project_a')::uuid, 'taskflow-beta@example.test');
select taskflow_rls_editor_test.assert_true((select count(*)=2 from public.project_members), 'Duplicate add is idempotent and cannot promote member');
select taskflow_rls_editor_test.expect_error('select public.add_project_member_by_email(current_setting(''taskflow_test.project_a'')::uuid, ''not-registered@example.test'')', '22023');
select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000003');
select set_config('taskflow_test.project_b', public.create_project('Test B')::text, true);
-- Alpha belongs to both projects; Beta must not see Gamma through that shared
-- teammate or use the display RPC to enumerate Alpha's other memberships.
select public.add_project_member_by_email(current_setting('taskflow_test.project_b')::uuid, 'taskflow-alpha@example.test');
insert into public.sections(id,project_id,name) values ('20000000-0000-0000-0000-000000000002',current_setting('taskflow_test.project_b')::uuid,'B section');
insert into public.tasks(id,project_id,section_id,title,assignee_id) values ('30000000-0000-0000-0000-000000000002',current_setting('taskflow_test.project_b')::uuid,'20000000-0000-0000-0000-000000000002','B task',auth.uid());

select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000001');
insert into public.sections(id,project_id,name) values ('20000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,'A section');
insert into public.tasks(id,project_id,section_id,title,assignee_id) values ('30000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,'20000000-0000-0000-0000-000000000001','A task',auth.uid());
insert into public.task_steps(id,project_id,task_id,title) values ('40000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,'30000000-0000-0000-0000-000000000001','A step');
insert into public.task_resources(project_id,task_id,title,url) values (current_setting('taskflow_test.project_a')::uuid,'30000000-0000-0000-0000-000000000001','A resource','https://example.com/guide');
insert into public.availability_slots(id,project_id,user_id,starts_at,ends_at) values ('50000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,auth.uid(),'2026-10-26T14:00:00Z','2026-10-26T17:00:00Z');

select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000002');
insert into taskflow_rls_editor_test.project_members values(current_setting('taskflow_test.project_b')::uuid,auth.uid(),'leader');
insert into taskflow_rls_editor_test.profiles values('10000000-0000-0000-0000-000000000001','Spoofed Alpha','private@example.test');
select taskflow_rls_editor_test.assert_true(not private.is_project_member(current_setting('taskflow_test.project_b')::uuid) and not private.is_project_leader(current_setting('taskflow_test.project_b')::uuid), 'Caller temp tables/search_path cannot forge membership or leader status');
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.projects), 'Member sees only project A');
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.tasks), 'Member cannot read B task by guessed ID');
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.profiles), 'Profiles are private even to teammates');
select taskflow_rls_editor_test.assert_true((select count(*)=2 from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid)), 'Project member can retrieve its two-person display roster');
select taskflow_rls_editor_test.assert_true((select display_name='Alpha' from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) where user_id='10000000-0000-0000-0000-000000000001'), 'Teammate name is visible without exposing profile row');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) where user_id='10000000-0000-0000-0000-000000000003'), 'Shared teammate does not expose unrelated project members');
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(current_setting(''taskflow_test.project_b'')::uuid)', '42501');
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(''00000000-0000-0000-0000-000000000000'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(null)', '42501');
select taskflow_rls_editor_test.assert_true((select array_agg(k order by k)=array['display_name','user_id']::text[] from (select distinct jsonb_object_keys(to_jsonb(d)) as k from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) as d) keys), 'Display RPC returns exactly user_id/display_name; no email, timestamps or metadata');
update public.profiles set display_name='Beta updated' where id=auth.uid();
select taskflow_rls_editor_test.assert_true((select display_name='Beta updated' from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) where user_id=auth.uid()), 'Display roster reflects live profile edits');
with changed as (update public.profiles set display_name='Impersonation' where id='10000000-0000-0000-0000-000000000001' returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=0 from changed), 'Teammate display visibility does not permit editing teammate profiles');
select taskflow_rls_editor_test.expect_error('update public.profiles set email=''spoof@example.test'' where id=auth.uid()', '42501');
select taskflow_rls_editor_test.expect_error('insert into public.profiles(id,email) values(auth.uid(),''spoof@example.test'')', '42501');
update public.projects set description='Member edit' where id=current_setting('taskflow_test.project_a')::uuid;
select taskflow_rls_editor_test.assert_true((select description='Member edit' from public.projects where id=current_setting('taskflow_test.project_a')::uuid), 'Members can edit project basics');
select taskflow_rls_editor_test.expect_error('update public.projects set created_by=auth.uid()', '42501');
update public.tasks set title='Edited by teammate', assignee_id=auth.uid() where id='30000000-0000-0000-0000-000000000001';
select taskflow_rls_editor_test.assert_true((select title='Edited by teammate' from public.tasks where id='30000000-0000-0000-0000-000000000001'), 'Assignment does not prevent teammate edits');
update public.task_steps set is_completed=true where id='40000000-0000-0000-0000-000000000001';
select taskflow_rls_editor_test.assert_true((select status='todo' from public.tasks where id='30000000-0000-0000-0000-000000000001'), 'Step completion does not complete parent task');
update public.task_resources set title='Updated by teammate';
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.availability_slots), 'Member can view teammate availability');
with changed as (update public.availability_slots set ends_at='2026-10-26T18:00:00Z' where id='50000000-0000-0000-0000-000000000001' returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=0 from changed), 'Member cannot edit teammate availability');
with changed as (delete from public.availability_slots where id='50000000-0000-0000-0000-000000000001' returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=0 from changed), 'Member cannot delete teammate availability');
select taskflow_rls_editor_test.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values (current_setting(''taskflow_test.project_a'')::uuid,''10000000-0000-0000-0000-000000000001'',now(),now()+interval ''1 hour'')', '42501');
insert into public.availability_slots(id,project_id,user_id,starts_at,ends_at) values('50000000-0000-0000-0000-000000000002',current_setting('taskflow_test.project_a')::uuid,auth.uid(),now(),now()+interval '1 hour');
with changed as (update public.availability_slots set ends_at=ends_at+interval '1 hour' where id='50000000-0000-0000-0000-000000000002' returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=1 from changed), 'Member can update own available time');
-- Free-time intervals may cross midnight. No busy/available flag is necessary.
insert into public.availability_slots(id,project_id,user_id,starts_at,ends_at) values('50000000-0000-0000-0000-000000000003',current_setting('taskflow_test.project_a')::uuid,auth.uid(),'2026-10-27T23:00:00+08:00','2026-10-28T01:00:00+08:00');
select taskflow_rls_editor_test.assert_true((select ends_at-starts_at=interval '2 hours' from public.availability_slots where id='50000000-0000-0000-0000-000000000003'), 'Overnight free time retains its exact duration');
with changed as (delete from public.availability_slots where id='50000000-0000-0000-0000-000000000003' returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=1 from changed), 'Member can delete own available time');
select taskflow_rls_editor_test.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values(current_setting(''taskflow_test.project_a'')::uuid,auth.uid(),now(),now())', '23514');
select taskflow_rls_editor_test.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values(current_setting(''taskflow_test.project_a'')::uuid,auth.uid(),now(),now()-interval ''1 hour'')', '23514');
select taskflow_rls_editor_test.expect_error('update public.availability_slots set user_id=''10000000-0000-0000-0000-000000000001'' where user_id=auth.uid()', '42501');

select taskflow_rls_editor_test.expect_error('update public.tasks set assignee_id=''10000000-0000-0000-0000-000000000003'' where id=''30000000-0000-0000-0000-000000000001''', '23503');
select taskflow_rls_editor_test.expect_error('update public.tasks set section_id=''20000000-0000-0000-0000-000000000002'' where id=''30000000-0000-0000-0000-000000000001''', '23503');
select taskflow_rls_editor_test.expect_error('insert into public.task_steps(project_id,task_id,title) values(current_setting(''taskflow_test.project_a'')::uuid,''30000000-0000-0000-0000-000000000002'',''Cross-project'')', '23503');
select taskflow_rls_editor_test.expect_error('insert into public.task_resources(project_id,task_id,title,url) values(current_setting(''taskflow_test.project_a'')::uuid,''30000000-0000-0000-0000-000000000002'',''Cross-project'',''https://example.com'')', '23503');
select taskflow_rls_editor_test.expect_error('update public.tasks set project_id=current_setting(''taskflow_test.project_b'')::uuid where id=''30000000-0000-0000-0000-000000000001''', '42501');
select taskflow_rls_editor_test.expect_error('update public.task_resources set url=''javascript:alert(1)''', '23514');
select taskflow_rls_editor_test.expect_error('insert into public.project_members(project_id,user_id,role) values(current_setting(''taskflow_test.project_b'')::uuid,auth.uid(),''leader'')', '42501');
select taskflow_rls_editor_test.expect_error('update public.project_members set role=''leader'' where user_id=auth.uid()', '42501');
select taskflow_rls_editor_test.expect_error('delete from public.project_members where user_id=auth.uid()', '42501');
select taskflow_rls_editor_test.expect_error('delete from public.projects', '42501');
select taskflow_rls_editor_test.expect_error('select public.add_project_member_by_email(current_setting(''taskflow_test.project_a'')::uuid,''taskflow-gamma@example.test'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.remove_project_member(current_setting(''taskflow_test.project_a'')::uuid,auth.uid())', '42501');
select taskflow_rls_editor_test.expect_error('select public.delete_project(current_setting(''taskflow_test.project_a'')::uuid)', '42501');

-- Gamma is a leader in B, but a non-member in A: no cross-project privileges.
select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000003');
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(current_setting(''taskflow_test.project_a'')::uuid)', '42501');
select taskflow_rls_editor_test.assert_true((select count(*)=2 from public.get_project_member_display(current_setting('taskflow_test.project_b')::uuid)), 'A leader sees only the requested project roster');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.project_members where project_id=current_setting('taskflow_test.project_a')::uuid), 'No recursive membership access or cross-project roster');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.task_steps where project_id=current_setting('taskflow_test.project_a')::uuid), 'Indirect steps protected');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.task_resources where project_id=current_setting('taskflow_test.project_a')::uuid), 'Indirect resources protected');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.availability_slots where project_id=current_setting('taskflow_test.project_a')::uuid), 'Availability isolated by project');
select taskflow_rls_editor_test.expect_error('insert into public.sections(project_id,name) values(current_setting(''taskflow_test.project_a'')::uuid,''Unauthorized'')', '42501');
select taskflow_rls_editor_test.expect_error('insert into public.tasks(project_id,section_id,title) values(current_setting(''taskflow_test.project_a'')::uuid,''20000000-0000-0000-0000-000000000001'',''Unauthorized'')', '42501');
select taskflow_rls_editor_test.expect_error('insert into public.task_steps(project_id,task_id,title) values(current_setting(''taskflow_test.project_a'')::uuid,''30000000-0000-0000-0000-000000000001'',''Unauthorized'')', '42501');
select taskflow_rls_editor_test.expect_error('select public.delete_project(current_setting(''taskflow_test.project_a'')::uuid)', '42501');
with changed as (update public.tasks set title='Unauthorized' where project_id=current_setting('taskflow_test.project_a')::uuid returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=0 from changed), 'Non-member task update affects zero rows');
with changed as (delete from public.task_steps where project_id=current_setting('taskflow_test.project_a')::uuid returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=0 from changed), 'Non-member child deletion affects zero rows');

select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000001');
select taskflow_rls_editor_test.expect_error('select public.remove_project_member(current_setting(''taskflow_test.project_a'')::uuid,auth.uid())', '22023');
with changed as (update public.availability_slots set ends_at=ends_at+interval '1 hour' where user_id='10000000-0000-0000-0000-000000000002' returning id)
select taskflow_rls_editor_test.assert_true((select count(*)=0 from changed), 'Even the leader cannot edit another member available time');
select public.remove_project_member(current_setting('taskflow_test.project_a')::uuid,'10000000-0000-0000-0000-000000000002');
select taskflow_rls_editor_test.assert_true((select count(*)=1 from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid)), 'Removed member disappears from display roster');
select taskflow_rls_editor_test.assert_true((select assignee_id is null from public.tasks where id='30000000-0000-0000-0000-000000000001'), 'Removal atomically unassigns tasks');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.availability_slots where user_id='10000000-0000-0000-0000-000000000002'), 'Removal deletes availability');
select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000002');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.projects), 'Removed member loses project access');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.tasks), 'Removed member loses task access');
select taskflow_rls_editor_test.expect_error('select public.get_project_member_display(current_setting(''taskflow_test.project_a'')::uuid)', '42501');
select taskflow_rls_editor_test.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values(current_setting(''taskflow_test.project_a'')::uuid,auth.uid(),now(),now()+interval ''1 hour'')', '42501');

select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000003');
select public.delete_project(current_setting('taskflow_test.project_b')::uuid);
set local role postgres;
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.tasks where project_id=current_setting('taskflow_test.project_b')::uuid), 'Leader deletion handles assigned tasks');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.project_members where project_id=current_setting('taskflow_test.project_b')::uuid), 'Project membership cascades');
set local role authenticated;
select taskflow_rls_editor_test.set_identity('10000000-0000-0000-0000-000000000001');
select public.delete_project(current_setting('taskflow_test.project_a')::uuid);
set local role postgres;
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.task_steps where project_id=current_setting('taskflow_test.project_a')::uuid), 'Steps cascade');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.task_resources where project_id=current_setting('taskflow_test.project_a')::uuid), 'Resources cascade');
select taskflow_rls_editor_test.assert_true(not exists(select 1 from public.availability_slots where project_id=current_setting('taskflow_test.project_a')::uuid), 'Availability cascades');
-- Check all eight exact signatures: counting avoids a vacuous pass when a
-- function is absent or accidentally changed from DEFINER to INVOKER.
do $$ declare v_oid oid; v_client_execute boolean; v_count integer := 0; begin
  for v_oid, v_client_execute in
    select signature::regprocedure::oid, client_execute from (values
      ('private.is_project_member(uuid)', true),
      ('private.is_project_leader(uuid)', true),
      ('private.sync_profile()', false),
      ('public.get_project_member_display(uuid)', true),
      ('public.create_project(text,text,date)', true),
      ('public.add_project_member_by_email(uuid,text)', true),
      ('public.remove_project_member(uuid,uuid)', true),
      ('public.delete_project(uuid)', true)
    ) as expected(signature, client_execute)
  loop
    v_count := v_count + 1;
    perform taskflow_rls_editor_test.assert_true((select p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and coalesce(p.proconfig @> array['search_path=""'],false) from pg_proc p where p.oid=v_oid), 'Every app definer has trusted postgres ownership and an empty search_path');
    perform taskflow_rls_editor_test.assert_true(not has_function_privilege('anon', v_oid, 'EXECUTE'), 'Anonymous role has no app definer execute rights');
    perform taskflow_rls_editor_test.assert_true(has_function_privilege('authenticated', v_oid, 'EXECUTE')=v_client_execute, 'Authenticated execute rights match the explicit allowlist');
    perform taskflow_rls_editor_test.assert_true(not exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.oid=v_oid and acl.grantee=0 and acl.privilege_type='EXECUTE'), 'PUBLIC has no implicit app definer execute rights');
  end loop;
  perform taskflow_rls_editor_test.assert_true(v_count=8, 'All expected app functions checked');
end; $$;
select taskflow_rls_editor_test.assert_true(not has_schema_privilege('authenticated','private','CREATE') and not has_schema_privilege('anon','private','USAGE'), 'Runtime roles cannot create private helpers or expose them anonymously');
select taskflow_rls_editor_test.assert_true(not pg_has_role('authenticated','postgres','USAGE') and not pg_has_role('anon','postgres','USAGE'), 'Runtime roles do not inherit the trusted owner');
-- Restore the editor role for result inspection; no owner SELECT is counted
-- as evidence that a runtime user can access application data.
set local role postgres;
select taskflow_rls_editor_test.assert_true((select count(*) > 0 from taskflow_rls_editor_test.results where checked_as='anon'), 'Anonymous assertions actually ran');
select taskflow_rls_editor_test.assert_true((select count(*) > 0 from taskflow_rls_editor_test.results where checked_as='authenticated' and claimed_user='10000000-0000-0000-0000-000000000001'), 'Alpha assertions actually ran');
select taskflow_rls_editor_test.assert_true((select count(*) > 0 from taskflow_rls_editor_test.results where checked_as='authenticated' and claimed_user='10000000-0000-0000-0000-000000000002'), 'Beta assertions actually ran');
select taskflow_rls_editor_test.assert_true((select count(*) > 0 from taskflow_rls_editor_test.results where checked_as='authenticated' and claimed_user='10000000-0000-0000-0000-000000000003'), 'Gamma assertions actually ran');
select 'PASS: all assertions completed; fixtures will now roll back' as result, checked_as, count(*) as successful_assertions, count(expected_sqlstate) as expected_denials
from taskflow_rls_editor_test.results group by checked_as order by checked_as;
rollback;

-- Read-only cleanup check AFTER rollback. Do not use this result alone as proof
-- of RLS success: the complete preceding test batch must finish without errors.
do $cleanup$ begin
  if to_regnamespace('taskflow_rls_editor_test') is not null or exists(select 1 from auth.users where id in ('10000000-0000-0000-0000-000000000001'::uuid,'10000000-0000-0000-0000-000000000002'::uuid,'10000000-0000-0000-0000-000000000003'::uuid)) then
    raise exception 'Rollback cleanup check failed: inspect test schema/fixture users';
  end if;
end; $cleanup$;
select 'ROLLBACK CONFIRMED - accept RLS results only when the ENTIRE script completed without errors' as result;
