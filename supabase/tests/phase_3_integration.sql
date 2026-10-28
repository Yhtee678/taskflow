-- Focused tests for the Phase 3 migration, NOT a repeat of the Google/two-account
-- workflow. Run manually after the migration on a disposable Supabase database.
-- No local Postgres installation or test extension is needed. NOT EXECUTED here.
begin;
do $test$
declare
 users uuid[] := array[]::uuid[]; emails text[] := array[]::text[];
 run_id text := gen_random_uuid()::text;
 project_a uuid; project_b uuid; section_a uuid := gen_random_uuid(); section_b uuid := gen_random_uuid(); foreign_section uuid := gen_random_uuid(); task_id uuid := gen_random_uuid(); i integer;
begin
 if current_user <> 'postgres' then raise exception 'Run as postgres on a disposable test project'; end if;
 for i in 1..7 loop
  users:=array_append(users,gen_random_uuid());emails:=array_append(emails,'phase3-'||run_id||'-'||i||'@example.test');
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(users[i],emails[i],now(),'{}'::jsonb);
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claim.role','',true);
 perform set_config('request.jwt.claims',json_build_object('sub',users[1],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if current_user<>'authenticated' or auth.uid()<>users[1] then raise exception 'Role/claims simulation failed'; end if;
 project_a:=public.create_project('Phase 3 migration test '||run_id);
 for i in 2..6 loop perform public.add_project_member_by_email(project_a,emails[i]); end loop;
 if (select count(*) from public.project_members where project_id=project_a)<>6 then raise exception 'Membership beyond five should be accepted'; end if;
 perform public.add_project_member_by_email(project_a,emails[6]);
 if (select count(*) from public.project_members where project_id=project_a)<>6 then raise exception 'Duplicate addition changed membership'; end if;
 insert into public.sections(id,project_id,name,position) values(section_a,project_a,'First',0),(section_b,project_a,'Second',1);
 insert into public.tasks(id,project_id,section_id,title) values(task_id,project_a,section_a,'Priority test');
 if (select priority from public.tasks where id=task_id)<>'normal' then raise exception 'Priority default is wrong'; end if;
 update public.tasks set priority='high' where id=task_id;
 begin update public.tasks set priority='urgent' where id=task_id;raise exception 'Invalid priority accepted';exception when check_violation then null;end;
 perform public.reorder_sections(project_a,array[section_b,section_a]);
 if (select position from public.sections where id=section_b)<>0 or (select position from public.sections where id=section_a)<>1 then raise exception 'Reorder failed'; end if;
 begin perform public.reorder_sections(project_a,array[section_a,section_a]);raise exception 'Duplicate order accepted';exception when sqlstate '22023' then null;end;
 begin perform public.reorder_sections(project_a,array[section_a]);raise exception 'Partial order accepted';exception when sqlstate '22023' then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',users[2],'role','authenticated')::text,true);
 update public.tasks set priority='low',status='in_progress' where id=task_id;
 if not exists(select 1 from public.tasks where id=task_id and priority='low' and status='in_progress') then raise exception 'Member cannot edit teammate priority';end if;
 perform public.reorder_sections(project_a,array[section_a,section_b]);
 begin perform public.add_project_member_by_email(project_a,emails[7]);raise exception 'Non-leader add succeeded';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',users[7],'role','authenticated')::text,true);
 project_b:=public.create_project('Other Phase 3 migration test '||run_id);
 insert into public.sections(id,project_id,name) values(foreign_section,project_b,'Other project');
 begin perform public.reorder_sections(project_a,array[section_a,section_b]);raise exception 'Outsider reordered sections';exception when insufficient_privilege then null;end;
 begin insert into public.project_members(project_id,user_id,role) values(project_a,users[7],'member');raise exception 'Direct enrollment succeeded';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',users[1],'role','authenticated')::text,true);
 begin perform public.reorder_sections(project_a,array[section_a,foreign_section]);raise exception 'Cross-project reorder accepted';exception when sqlstate '22023' then null;end;
 execute 'set local role postgres';
 if has_function_privilege('anon','public.reorder_sections(uuid,uuid[])','EXECUTE') then raise exception 'Anonymous reorder execute grant';end if;
 if not exists(select 1 from pg_proc where oid='public.reorder_sections(uuid,uuid[])'::regprocedure and prosecdef and pg_get_userbyid(proowner)='postgres' and proconfig @> array['search_path=""']) then raise exception 'Unsafe reorder function ownership/search path';end if;
end; $test$;
select 'PASS: Phase 3 migration assertions completed; rolling back all synthetic fixtures' as result;
rollback;
