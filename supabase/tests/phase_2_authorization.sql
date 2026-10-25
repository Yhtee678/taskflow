-- Run ONLY on a disposable Supabase test database, after the migration, as postgres:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_2_authorization.sql
-- Fixtures are rolled back. Every assertion must succeed; this is NOT a mock RLS test.
begin;
-- Test setup and fixtures require the trusted owner; assertions later explicitly
-- switch to roles without RLS bypass. This suite is not a signed-JWT/API test.
do $$ begin
  if current_user <> 'postgres' then raise exception 'Run the SQL suite as postgres on a disposable test database'; end if;
end; $$;

create function pg_temp.assert_true(p_value boolean, p_message text) returns void
language plpgsql security invoker set search_path = '' as $$ begin
  if p_value is distinct from true then raise exception 'FAIL: %', p_message; end if;
end; $$;

-- Caller-controlled search paths and temporary names must not shadow definer
-- function relations. These tables are test decoys, not application fixtures.
create temporary table project_members (project_id uuid, user_id uuid, role text);
create temporary table profiles (id uuid, display_name text, email text);
grant select, insert on pg_temp.project_members, pg_temp.profiles to authenticated;
set local search_path = pg_temp, public, private;
create function pg_temp.expect_error(p_sql text, p_state text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_state text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state = p_state then return; end if;
    raise exception 'Expected SQLSTATE %, got % for %', p_state, v_state, p_sql;
  end;
  raise exception 'Expected SQLSTATE %, but statement succeeded: %', p_state, p_sql;
end; $$;
-- Use the modern PostgREST claim object; clear legacy settings so stale claims
-- cannot silently make an access assertion run as the wrong identity.
create function pg_temp.set_identity(p_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', p_user_id, 'role', current_user)::text, true);
  perform pg_temp.assert_true(auth.uid() is not distinct from p_user_id, 'JWT simulation must resolve the intended auth.uid()');
end; $$;
-- GRANT uses the actual temporary namespace name, not the pg_temp alias.
do $$ declare v_schema text; begin
  select nspname into v_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to anon, authenticated', v_schema);
  execute format('grant execute on function %I.assert_true(boolean, text), %I.expect_error(text, text), %I.set_identity(uuid) to anon, authenticated', v_schema, v_schema, v_schema);
end; $$;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','taskflow-alpha@example.test',now(),'{"full_name":"Alpha"}'),
 ('10000000-0000-0000-0000-000000000002','taskflow-beta@example.test',now(),'{"full_name":"Beta","role":"leader"}'),
 ('10000000-0000-0000-0000-000000000003','taskflow-gamma@example.test',now(),'{"full_name":"Gamma"}');

select pg_temp.assert_true((select count(*) = 8 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','projects','project_members','sections','tasks','task_steps','task_resources','availability_slots') and c.relrowsecurity), 'RLS enabled on all eight tables');
select pg_temp.assert_true((select count(*)=8 and bool_and(pg_get_userbyid(c.relowner)='postgres') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','projects','project_members','sections','tasks','task_steps','task_resources','availability_slots')), 'Application tables have trusted postgres ownership');
select pg_temp.assert_true((select count(*)=3 from public.profiles where email like 'taskflow-%@example.test'), 'Auth trigger provisions profiles');
select pg_temp.assert_true(not exists(select 1 from public.project_members where user_id='10000000-0000-0000-0000-000000000002'), 'Untrusted metadata grants no membership');
update auth.users set email='taskflow-beta-updated@example.test' where id='10000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select email='taskflow-beta-updated@example.test' from public.profiles where id='10000000-0000-0000-0000-000000000002'), 'Auth email changes synchronize profiles');
update auth.users set email='taskflow-beta@example.test' where id='10000000-0000-0000-0000-000000000002';

set local role anon;
select pg_temp.set_identity(null);
select pg_temp.assert_true(current_user = 'anon' and not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user), 'Anonymous assertions run without owner/BYPASSRLS rights');
do $$ declare t text; begin
  foreach t in array array['profiles','projects','project_members','sections','tasks','task_steps','task_resources','availability_slots'] loop
    perform pg_temp.expect_error(format('select * from public.%I', t), '42501');
  end loop;
end; $$;
select pg_temp.expect_error('select * from public.profiles', '42501');
select pg_temp.expect_error('select * from public.projects', '42501');
select pg_temp.expect_error('select * from public.tasks', '42501');
select pg_temp.expect_error('select public.create_project(''Anonymous'')', '42501');
select pg_temp.expect_error('select public.get_project_member_display(''00000000-0000-0000-0000-000000000000'')', '42501');
select pg_temp.expect_error('select private.is_project_member(''00000000-0000-0000-0000-000000000000'')', '42501');
reset role;
set local role authenticated;
select pg_temp.assert_true(current_user = 'authenticated' and not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user), 'Authenticated assertions run without owner/BYPASSRLS rights');
select pg_temp.set_identity(null);
-- Current Supabase auth.uid() also supports the historical scalar setting.
-- Test it once, then return all subsequent checks to modern JSON claims.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(auth.uid()='10000000-0000-0000-0000-000000000001'::uuid, 'Legacy scalar subject is recognized');
select pg_temp.set_identity(null);
select pg_temp.expect_error('select public.get_project_member_display(null)', '42501');
select pg_temp.expect_error('select public.create_project(''Missing identity'')', '42501');
select pg_temp.expect_error('select public.add_project_member_by_email(''00000000-0000-0000-0000-000000000000'',''taskflow-beta@example.test'')', '42501');
select pg_temp.expect_error('select public.remove_project_member(''00000000-0000-0000-0000-000000000000'',''10000000-0000-0000-0000-000000000002'')', '42501');
select pg_temp.expect_error('select public.delete_project(''00000000-0000-0000-0000-000000000000'')', '42501');
select pg_temp.set_identity('10000000-0000-0000-0000-000000000001');
select set_config('taskflow_test.project_a', public.create_project('Test A')::text, true);
select pg_temp.assert_true((select count(*)=1 from public.project_members where project_id=current_setting('taskflow_test.project_a')::uuid and role='leader' and user_id=auth.uid()), 'Creator is leader atomically');
select pg_temp.expect_error('select public.create_project(''   '')', '23514');
select pg_temp.assert_true((select count(*)=1 from public.projects), 'Invalid project creation leaves no partial row');
select public.add_project_member_by_email(current_setting('taskflow_test.project_a')::uuid, ' TASKFLOW-BETA@EXAMPLE.TEST ');
select public.add_project_member_by_email(current_setting('taskflow_test.project_a')::uuid, 'taskflow-beta@example.test');
select pg_temp.assert_true((select count(*)=2 from public.project_members), 'Duplicate add is idempotent and cannot promote member');
select pg_temp.expect_error('select public.add_project_member_by_email(current_setting(''taskflow_test.project_a'')::uuid, ''not-registered@example.test'')', '22023');
select pg_temp.set_identity('10000000-0000-0000-0000-000000000003');
select set_config('taskflow_test.project_b', public.create_project('Test B')::text, true);
-- Alpha belongs to both projects; Beta must not see Gamma through that shared
-- teammate or use the display RPC to enumerate Alpha's other memberships.
select public.add_project_member_by_email(current_setting('taskflow_test.project_b')::uuid, 'taskflow-alpha@example.test');
insert into public.sections(id,project_id,name) values ('20000000-0000-0000-0000-000000000002',current_setting('taskflow_test.project_b')::uuid,'B section');
insert into public.tasks(id,project_id,section_id,title,assignee_id) values ('30000000-0000-0000-0000-000000000002',current_setting('taskflow_test.project_b')::uuid,'20000000-0000-0000-0000-000000000002','B task',auth.uid());

select pg_temp.set_identity('10000000-0000-0000-0000-000000000001');
insert into public.sections(id,project_id,name) values ('20000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,'A section');
insert into public.tasks(id,project_id,section_id,title,assignee_id) values ('30000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,'20000000-0000-0000-0000-000000000001','A task',auth.uid());
insert into public.task_steps(id,project_id,task_id,title) values ('40000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,'30000000-0000-0000-0000-000000000001','A step');
insert into public.task_resources(project_id,task_id,title,url) values (current_setting('taskflow_test.project_a')::uuid,'30000000-0000-0000-0000-000000000001','A resource','https://example.com/guide');
insert into public.availability_slots(id,project_id,user_id,starts_at,ends_at) values ('50000000-0000-0000-0000-000000000001',current_setting('taskflow_test.project_a')::uuid,auth.uid(),'2026-10-26T14:00:00Z','2026-10-26T17:00:00Z');

select pg_temp.set_identity('10000000-0000-0000-0000-000000000002');
insert into pg_temp.project_members values(current_setting('taskflow_test.project_b')::uuid,auth.uid(),'leader');
insert into pg_temp.profiles values('10000000-0000-0000-0000-000000000001','Spoofed Alpha','private@example.test');
select pg_temp.assert_true(not private.is_project_member(current_setting('taskflow_test.project_b')::uuid) and not private.is_project_leader(current_setting('taskflow_test.project_b')::uuid), 'Caller temp tables/search_path cannot forge membership or leader status');
select pg_temp.assert_true((select count(*)=1 from public.projects), 'Member sees only project A');
select pg_temp.assert_true((select count(*)=1 from public.tasks), 'Member cannot read B task by guessed ID');
select pg_temp.assert_true((select count(*)=1 from public.profiles), 'Profiles are private even to teammates');
select pg_temp.assert_true((select count(*)=2 from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid)), 'Project member can retrieve its two-person display roster');
select pg_temp.assert_true((select display_name='Alpha' from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) where user_id='10000000-0000-0000-0000-000000000001'), 'Teammate name is visible without exposing profile row');
select pg_temp.assert_true(not exists(select 1 from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) where user_id='10000000-0000-0000-0000-000000000003'), 'Shared teammate does not expose unrelated project members');
select pg_temp.expect_error('select public.get_project_member_display(current_setting(''taskflow_test.project_b'')::uuid)', '42501');
select pg_temp.expect_error('select public.get_project_member_display(''00000000-0000-0000-0000-000000000000'')', '42501');
select pg_temp.expect_error('select public.get_project_member_display(null)', '42501');
select pg_temp.assert_true((select array_agg(k order by k)=array['display_name','user_id']::text[] from (select distinct jsonb_object_keys(to_jsonb(d)) as k from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) as d) keys), 'Display RPC returns exactly user_id/display_name; no email, timestamps or metadata');
update public.profiles set display_name='Beta updated' where id=auth.uid();
select pg_temp.assert_true((select display_name='Beta updated' from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid) where user_id=auth.uid()), 'Display roster reflects live profile edits');
with changed as (update public.profiles set display_name='Impersonation' where id='10000000-0000-0000-0000-000000000001' returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Teammate display visibility does not permit editing teammate profiles');
select pg_temp.expect_error('update public.profiles set email=''spoof@example.test'' where id=auth.uid()', '42501');
select pg_temp.expect_error('insert into public.profiles(id,email) values(auth.uid(),''spoof@example.test'')', '42501');
update public.projects set description='Member edit' where id=current_setting('taskflow_test.project_a')::uuid;
select pg_temp.assert_true((select description='Member edit' from public.projects where id=current_setting('taskflow_test.project_a')::uuid), 'Members can edit project basics');
select pg_temp.expect_error('update public.projects set created_by=auth.uid()', '42501');
update public.tasks set title='Edited by teammate', assignee_id=auth.uid() where id='30000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select title='Edited by teammate' from public.tasks where id='30000000-0000-0000-0000-000000000001'), 'Assignment does not prevent teammate edits');
update public.task_steps set is_completed=true where id='40000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select status='todo' from public.tasks where id='30000000-0000-0000-0000-000000000001'), 'Step completion does not complete parent task');
update public.task_resources set title='Updated by teammate';
select pg_temp.assert_true((select count(*)=1 from public.availability_slots), 'Member can view teammate availability');
with changed as (update public.availability_slots set ends_at='2026-10-26T18:00:00Z' where id='50000000-0000-0000-0000-000000000001' returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Member cannot edit teammate availability');
with changed as (delete from public.availability_slots where id='50000000-0000-0000-0000-000000000001' returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Member cannot delete teammate availability');
select pg_temp.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values (current_setting(''taskflow_test.project_a'')::uuid,''10000000-0000-0000-0000-000000000001'',now(),now()+interval ''1 hour'')', '42501');
insert into public.availability_slots(id,project_id,user_id,starts_at,ends_at) values('50000000-0000-0000-0000-000000000002',current_setting('taskflow_test.project_a')::uuid,auth.uid(),now(),now()+interval '1 hour');
with changed as (update public.availability_slots set ends_at=ends_at+interval '1 hour' where id='50000000-0000-0000-0000-000000000002' returning id)
select pg_temp.assert_true((select count(*)=1 from changed), 'Member can update own available time');
-- Free-time intervals may cross midnight. No busy/available flag is necessary.
insert into public.availability_slots(id,project_id,user_id,starts_at,ends_at) values('50000000-0000-0000-0000-000000000003',current_setting('taskflow_test.project_a')::uuid,auth.uid(),'2026-10-27T23:00:00+08:00','2026-10-28T01:00:00+08:00');
select pg_temp.assert_true((select ends_at-starts_at=interval '2 hours' from public.availability_slots where id='50000000-0000-0000-0000-000000000003'), 'Overnight free time retains its exact duration');
with changed as (delete from public.availability_slots where id='50000000-0000-0000-0000-000000000003' returning id)
select pg_temp.assert_true((select count(*)=1 from changed), 'Member can delete own available time');
select pg_temp.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values(current_setting(''taskflow_test.project_a'')::uuid,auth.uid(),now(),now())', '23514');
select pg_temp.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values(current_setting(''taskflow_test.project_a'')::uuid,auth.uid(),now(),now()-interval ''1 hour'')', '23514');
select pg_temp.expect_error('update public.availability_slots set user_id=''10000000-0000-0000-0000-000000000001'' where user_id=auth.uid()', '42501');

select pg_temp.expect_error('update public.tasks set assignee_id=''10000000-0000-0000-0000-000000000003'' where id=''30000000-0000-0000-0000-000000000001''', '23503');
select pg_temp.expect_error('update public.tasks set section_id=''20000000-0000-0000-0000-000000000002'' where id=''30000000-0000-0000-0000-000000000001''', '23503');
select pg_temp.expect_error('insert into public.task_steps(project_id,task_id,title) values(current_setting(''taskflow_test.project_a'')::uuid,''30000000-0000-0000-0000-000000000002'',''Cross-project'')', '23503');
select pg_temp.expect_error('insert into public.task_resources(project_id,task_id,title,url) values(current_setting(''taskflow_test.project_a'')::uuid,''30000000-0000-0000-0000-000000000002'',''Cross-project'',''https://example.com'')', '23503');
select pg_temp.expect_error('update public.tasks set project_id=current_setting(''taskflow_test.project_b'')::uuid where id=''30000000-0000-0000-0000-000000000001''', '42501');
select pg_temp.expect_error('update public.task_resources set url=''javascript:alert(1)''', '23514');
select pg_temp.expect_error('insert into public.project_members(project_id,user_id,role) values(current_setting(''taskflow_test.project_b'')::uuid,auth.uid(),''leader'')', '42501');
select pg_temp.expect_error('update public.project_members set role=''leader'' where user_id=auth.uid()', '42501');
select pg_temp.expect_error('delete from public.project_members where user_id=auth.uid()', '42501');
select pg_temp.expect_error('delete from public.projects', '42501');
select pg_temp.expect_error('select public.add_project_member_by_email(current_setting(''taskflow_test.project_a'')::uuid,''taskflow-gamma@example.test'')', '42501');
select pg_temp.expect_error('select public.remove_project_member(current_setting(''taskflow_test.project_a'')::uuid,auth.uid())', '42501');
select pg_temp.expect_error('select public.delete_project(current_setting(''taskflow_test.project_a'')::uuid)', '42501');

-- Gamma is a leader in B, but a non-member in A: no cross-project privileges.
select pg_temp.set_identity('10000000-0000-0000-0000-000000000003');
select pg_temp.expect_error('select public.get_project_member_display(current_setting(''taskflow_test.project_a'')::uuid)', '42501');
select pg_temp.assert_true((select count(*)=2 from public.get_project_member_display(current_setting('taskflow_test.project_b')::uuid)), 'A leader sees only the requested project roster');
select pg_temp.assert_true(not exists(select 1 from public.project_members where project_id=current_setting('taskflow_test.project_a')::uuid), 'No recursive membership access or cross-project roster');
select pg_temp.assert_true(not exists(select 1 from public.task_steps where project_id=current_setting('taskflow_test.project_a')::uuid), 'Indirect steps protected');
select pg_temp.assert_true(not exists(select 1 from public.task_resources where project_id=current_setting('taskflow_test.project_a')::uuid), 'Indirect resources protected');
select pg_temp.assert_true(not exists(select 1 from public.availability_slots where project_id=current_setting('taskflow_test.project_a')::uuid), 'Availability isolated by project');
select pg_temp.expect_error('insert into public.sections(project_id,name) values(current_setting(''taskflow_test.project_a'')::uuid,''Unauthorized'')', '42501');
select pg_temp.expect_error('insert into public.tasks(project_id,section_id,title) values(current_setting(''taskflow_test.project_a'')::uuid,''20000000-0000-0000-0000-000000000001'',''Unauthorized'')', '42501');
select pg_temp.expect_error('insert into public.task_steps(project_id,task_id,title) values(current_setting(''taskflow_test.project_a'')::uuid,''30000000-0000-0000-0000-000000000001'',''Unauthorized'')', '42501');
select pg_temp.expect_error('select public.delete_project(current_setting(''taskflow_test.project_a'')::uuid)', '42501');
with changed as (update public.tasks set title='Unauthorized' where project_id=current_setting('taskflow_test.project_a')::uuid returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Non-member task update affects zero rows');
with changed as (delete from public.task_steps where project_id=current_setting('taskflow_test.project_a')::uuid returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Non-member child deletion affects zero rows');

select pg_temp.set_identity('10000000-0000-0000-0000-000000000001');
select pg_temp.expect_error('select public.remove_project_member(current_setting(''taskflow_test.project_a'')::uuid,auth.uid())', '22023');
with changed as (update public.availability_slots set ends_at=ends_at+interval '1 hour' where user_id='10000000-0000-0000-0000-000000000002' returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Even the leader cannot edit another member available time');
select public.remove_project_member(current_setting('taskflow_test.project_a')::uuid,'10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true((select count(*)=1 from public.get_project_member_display(current_setting('taskflow_test.project_a')::uuid)), 'Removed member disappears from display roster');
select pg_temp.assert_true((select assignee_id is null from public.tasks where id='30000000-0000-0000-0000-000000000001'), 'Removal atomically unassigns tasks');
select pg_temp.assert_true(not exists(select 1 from public.availability_slots where user_id='10000000-0000-0000-0000-000000000002'), 'Removal deletes availability');
select pg_temp.set_identity('10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(not exists(select 1 from public.projects), 'Removed member loses project access');
select pg_temp.assert_true(not exists(select 1 from public.tasks), 'Removed member loses task access');
select pg_temp.expect_error('select public.get_project_member_display(current_setting(''taskflow_test.project_a'')::uuid)', '42501');
select pg_temp.expect_error('insert into public.availability_slots(project_id,user_id,starts_at,ends_at) values(current_setting(''taskflow_test.project_a'')::uuid,auth.uid(),now(),now()+interval ''1 hour'')', '42501');

select pg_temp.set_identity('10000000-0000-0000-0000-000000000003');
select public.delete_project(current_setting('taskflow_test.project_b')::uuid);
reset role;
select pg_temp.assert_true(not exists(select 1 from public.tasks where project_id=current_setting('taskflow_test.project_b')::uuid), 'Leader deletion handles assigned tasks');
select pg_temp.assert_true(not exists(select 1 from public.project_members where project_id=current_setting('taskflow_test.project_b')::uuid), 'Project membership cascades');
set local role authenticated;
select pg_temp.set_identity('10000000-0000-0000-0000-000000000001');
select public.delete_project(current_setting('taskflow_test.project_a')::uuid);
reset role;
select pg_temp.assert_true(not exists(select 1 from public.task_steps where project_id=current_setting('taskflow_test.project_a')::uuid), 'Steps cascade');
select pg_temp.assert_true(not exists(select 1 from public.task_resources where project_id=current_setting('taskflow_test.project_a')::uuid), 'Resources cascade');
select pg_temp.assert_true(not exists(select 1 from public.availability_slots where project_id=current_setting('taskflow_test.project_a')::uuid), 'Availability cascades');
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
    perform pg_temp.assert_true((select p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and coalesce(p.proconfig @> array['search_path=""'],false) from pg_proc p where p.oid=v_oid), 'Every app definer has trusted postgres ownership and an empty search_path');
    perform pg_temp.assert_true(not has_function_privilege('anon', v_oid, 'EXECUTE'), 'Anonymous role has no app definer execute rights');
    perform pg_temp.assert_true(has_function_privilege('authenticated', v_oid, 'EXECUTE')=v_client_execute, 'Authenticated execute rights match the explicit allowlist');
    perform pg_temp.assert_true(not exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.oid=v_oid and acl.grantee=0 and acl.privilege_type='EXECUTE'), 'PUBLIC has no implicit app definer execute rights');
  end loop;
  perform pg_temp.assert_true(v_count=8, 'All expected app functions checked');
end; $$;
select pg_temp.assert_true(not has_schema_privilege('authenticated','private','CREATE') and not has_schema_privilege('anon','private','USAGE'), 'Runtime roles cannot create private helpers or expose them anonymously');
select pg_temp.assert_true(not pg_has_role('authenticated','postgres','USAGE') and not pg_has_role('anon','postgres','USAGE'), 'Runtime roles do not inherit the trusted owner');
select 'PASS: Phase 2 authorization assertions completed; rolling back fixtures' as result;
rollback;
