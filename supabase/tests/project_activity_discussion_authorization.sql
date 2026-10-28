-- NOT EXECUTED. Confirm a disposable Supabase project and select postgres in
-- SQL Editor. Run the WHOLE file after 20261027000100. Never change ROLLBACK.
-- Runtime-role checks test RLS; owner inspections test event/fanout cardinality.
-- This simulates JWT claims, not Google signatures or HTTP API transport.
begin;
set local row_security=on;
set local statement_timeout='60s';
do $test$
declare
 v_users uuid[]:=array[]::uuid[];v_emails text[]:=array[]::text[];v_run text:=gen_random_uuid()::text;
 v_p uuid;v_other uuid;v_section uuid:=gen_random_uuid();v_task uuid:=gen_random_uuid();v_reminder_task uuid:=gen_random_uuid();
 v_comment uuid;v_delete_comment uuid;v_activity uuid;v_count bigint;v_i integer;v_signature text;
begin
 if current_user<>'postgres' then raise exception 'Run as postgres on a disposable project';end if;
 for v_i in 1..7 loop
  v_users:=array_append(v_users,gen_random_uuid());v_emails:=array_append(v_emails,'activity-'||v_run||'-'||v_i||'@example.test');
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(v_users[v_i],v_emails[v_i],now(),jsonb_build_object('full_name','Member '||v_i));
 end loop;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','',true);
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[1],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if current_user<>'authenticated' or auth.uid()<>v_users[1] or (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) then raise exception 'Unsafe identity simulation';end if;
 v_p:=public.create_project('Activity rollback test '||v_run);
 for v_i in 2..6 loop perform public.add_project_member_by_email(v_p,v_emails[v_i]);end loop;
 if (select count(*) from public.project_members m where m.project_id=v_p)<>6 then raise exception 'Membership capped';end if;
 insert into public.sections(id,project_id,name) values(v_section,v_p,'Test');
 insert into public.tasks(id,project_id,section_id,title,assignee_id) values(v_task,v_p,v_section,'Original task title',v_users[2]);
 if (select count(*) from public.project_activities a where a.project_id=v_p)<>1 then raise exception 'Creation should record exactly one activity, including its initial assignment';end if;
 select a.id into v_activity from public.project_activities a where a.task_id=v_task;
 if not exists(select 1 from public.project_activities a where a.id=v_activity and a.actor_id=v_users[1] and a.kind='task_created' and a.assignee_name='Member 2') then raise exception 'Creation attribution wrong';end if;
 if exists(select 1 from public.notifications n where n.activity_id=v_activity) then raise exception 'Actor notified of own creation';end if;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.activity_id=v_activity)<>1 or not exists(select 1 from public.notifications n where n.activity_id=v_activity and n.user_id=v_users[2] and n.kind='task_assigned') then raise exception 'Initial assignment notification changed';end if;
 execute 'set local role authenticated';
 update public.tasks t set assignee_id=v_users[3] where t.id=v_task;
 update public.tasks t set assignee_id=v_users[3] where t.id=v_task;
 if (select count(*) from public.project_activities a where a.task_id=v_task and a.kind='task_reassigned')<>1 then raise exception 'Reassignment duplicated';end if;
 select count(*) into v_count from public.project_activities a where a.project_id=v_p;
 update public.tasks t set title='Current task title',priority='high',description='Not an activity' where t.id=v_task;
 if (select count(*) from public.project_activities a where a.project_id=v_p)<>v_count then raise exception 'Unrelated field produced activity';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[2],'role','authenticated')::text,true);
 update public.tasks t set status='in_progress' where t.id=v_task;
 update public.tasks t set status='done' where t.id=v_task;
 update public.tasks t set status='done' where t.id=v_task;
 if (select count(*) from public.project_activities a where a.task_id=v_task and a.kind='task_completed')<>1 or exists(select 1 from public.project_activities a where a.task_id=v_task and a.kind='task_status_changed' and a.task_status='done') then raise exception 'Completion activity duplicated';end if;
 select a.id into v_activity from public.project_activities a where a.task_id=v_task and a.kind='task_completed';
 if not exists(select 1 from public.project_activities a where a.id=v_activity and a.actor_id=v_users[2]) then raise exception 'Actor cannot see own shared activity';end if;
 if exists(select 1 from public.notifications n where n.activity_id=v_activity) then raise exception 'Completion actor notified';end if;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.activity_id=v_activity)<>5 or exists(select 1 from public.notifications n where n.activity_id=v_activity and n.kind<>'task_completed') then raise exception 'Completion fanout duplicated, capped or misclassified';end if;
 execute 'set local role authenticated';
 update public.tasks t set due_at=statement_timestamp()+interval '12 hours' where t.id=v_task;
 if (select count(*) from public.project_activities a where a.task_id=v_task and a.kind='deadline_changed')<>1 then raise exception 'Deadline activity missing';end if;
 insert into public.task_comments(project_id,task_id,body) values(v_p,v_task,'Existing Task Comments still work');
 if (select count(*) from public.project_activities a where a.task_id=v_task and a.kind='comment_added')<>1 then raise exception 'Task comment activity missing/duplicated';end if;
 insert into public.project_discussion_comments(project_id,body) values(v_p,'Own removable discussion') returning id into v_delete_comment;
 delete from public.project_discussion_comments d where d.id=v_delete_comment;
 if not found then raise exception 'Own discussion delete failed';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[3],'role','authenticated')::text,true);
 insert into public.project_discussion_comments(project_id,body) values(v_p,'General project question') returning id into v_comment;
 if not exists(select 1 from public.project_discussion_comments d where d.id=v_comment and d.author_id=v_users[3] and d.author_name='Member 3') then raise exception 'Discussion attribution wrong';end if;
 select a.id into v_activity from public.project_activities a where a.project_id=v_p and a.kind='discussion_added' and a.actor_id=v_users[3];
 if v_activity is null or exists(select 1 from public.notifications n where n.activity_id=v_activity) then raise exception 'Missing discussion activity or actor notified';end if;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.activity_id=v_activity)<>5 or exists(select 1 from public.notifications n where n.activity_id=v_activity and (n.task_id is not null or n.kind<>'discussion_added' or n.project_id<>v_p)) then raise exception 'Discussion recipients/destination wrong';end if;
 if exists(select 1 from public.notifications n where n.activity_id is not null group by n.user_id,n.activity_id having count(*)>1) then raise exception 'Duplicate delivery for same activity';end if;
 execute 'set local role authenticated';
 begin insert into public.project_discussion_comments(project_id,body,author_id) values(v_p,'Forged',v_users[1]);raise exception 'Author spoof accepted';exception when insufficient_privilege then null;end;
 begin insert into public.project_discussion_comments(project_id,body,author_name) values(v_p,'Forged','Leader');raise exception 'Author-name spoof accepted';exception when insufficient_privilege then null;end;
 begin update public.project_discussion_comments d set body='Edited' where d.id=v_comment;raise exception 'Discussion editing permitted';exception when insufficient_privilege then null;end;
 begin insert into public.project_discussion_comments(project_id,body) values(v_p,' ');raise exception 'Blank comment accepted';exception when check_violation then null;end;
 begin insert into public.project_activities(project_id,actor_name,kind) values(v_p,'Fake','discussion_added');raise exception 'Activity forgery accepted';exception when insufficient_privilege then null;end;
 begin update public.project_activities a set actor_name='Fake' where a.id=v_activity;raise exception 'Activity mutation accepted';exception when insufficient_privilege then null;end;
 begin delete from public.project_activities a where a.id=v_activity;raise exception 'Activity deletion accepted';exception when insufficient_privilege then null;end;
 begin perform private.record_project_activity(v_p,v_task,'task_completed');raise exception 'Private recorder callable';exception when insufficient_privilege then null;end;
 begin update public.notifications n set activity_id=null where n.activity_id=v_activity;raise exception 'Activity link mutable';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[1],'role','authenticated')::text,true);
 delete from public.project_discussion_comments d where d.id=v_comment;
 if found then raise exception 'Leader deleted another author discussion';end if;
 -- Existing reminder generation remains independent of shared history.
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[2],'role','authenticated')::text,true);
 insert into public.tasks(id,project_id,section_id,title,assignee_id,due_at) values(v_reminder_task,v_p,v_section,'Reminder test',v_users[2],statement_timestamp()+interval '12 hours');
 select count(*) into v_count from public.project_activities a where a.project_id=v_p;
 if public.refresh_deadline_reminders()<>1 then raise exception 'Reminder integration failed';end if;
 if public.refresh_deadline_reminders()<>0 then raise exception 'Reminder duplicated';end if;
 if (select count(*) from public.project_activities a where a.project_id=v_p)<>v_count then raise exception 'Reminder polluted activity feed';end if;
 if not exists(select 1 from public.notifications n where n.task_id=v_reminder_task and n.kind='deadline_approaching' and n.activity_id is null) then raise exception 'Reminder was incorrectly linked to activity';end if;
 -- Other projects and guessed IDs remain isolated.
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[7],'role','authenticated')::text,true);
 v_other:=public.create_project('Other activity project '||v_run);
 insert into public.project_discussion_comments(project_id,body) values(v_other,'Other project only');
 if exists(select 1 from public.project_activities a where a.project_id=v_p) or exists(select 1 from public.project_discussion_comments d where d.project_id=v_p) then raise exception 'Cross-project history/discussion leak';end if;
 begin insert into public.project_discussion_comments(project_id,body) values(v_p,'Unauthorized');raise exception 'Unrelated member posted';exception when insufficient_privilege then null;end;
 delete from public.project_discussion_comments d where d.id=v_comment;
 if found then raise exception 'Unrelated member deleted comment';end if;
 -- Removal blocks current reads and purges recipient notifications, while other
 -- members retain historical discussion/activity, including former actors.
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[1],'role','authenticated')::text,true);
 perform public.remove_project_member(v_p,v_users[3]);
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[3],'role','authenticated')::text,true);
 if exists(select 1 from public.project_activities a where a.project_id=v_p) or exists(select 1 from public.project_discussion_comments d where d.project_id=v_p) or exists(select 1 from public.notifications n where n.project_id=v_p) then raise exception 'Removed member retained project data';end if;
 delete from public.project_discussion_comments d where d.id=v_comment;
 if found then raise exception 'Removed author deleted own historical discussion';end if;
 begin insert into public.project_discussion_comments(project_id,body) values(v_p,'After removal');raise exception 'Removed member posted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',v_users[1],'role','authenticated')::text,true);
 if not exists(select 1 from public.project_discussion_comments d where d.id=v_comment) then raise exception 'Historical discussion lost on removal';end if;
 update public.notifications n set read_at=statement_timestamp() where n.activity_id=v_activity;
 if not exists(select 1 from public.notifications n where n.activity_id=v_activity and n.read_at is not null) then raise exception 'Discussion notification read state not writable by recipient';end if;
 delete from public.tasks t where t.id=v_task;
 if not exists(select 1 from public.project_activities a where a.project_id=v_p and a.kind='task_created' and a.task_id is null and a.task_title='Original task title') then raise exception 'Deleted-task history lost';end if;
 if not exists(select 1 from public.notifications n where n.activity_id=v_activity and n.kind='discussion_added') then raise exception 'Task deletion removed project discussion notification';end if;
 execute 'set local role anon';perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform * from public.project_activities;raise exception 'Anonymous activity access';exception when insufficient_privilege then null;end;
 begin perform * from public.project_discussion_comments;raise exception 'Anonymous discussion access';exception when insufficient_privilege then null;end;
 execute 'set local role postgres';
 foreach v_signature in array array['private.record_project_activity(uuid,uuid,text,text,timestamptz,uuid)','private.notify_task_activity()','private.notify_task_comment()','private.notify_project_discussion()'] loop
  if not exists(select 1 from pg_proc f where f.oid=v_signature::regprocedure and f.prosecdef and pg_get_userbyid(f.proowner)='postgres' and f.proconfig @> array['search_path=""']) or has_function_privilege('authenticated',v_signature,'EXECUTE') or has_function_privilege('anon',v_signature,'EXECUTE') then raise exception 'Unsafe helper ownership/search_path/grants %',v_signature;end if;
 end loop;
 if (select count(*) from pg_trigger t where t.tgrelid='public.tasks'::regclass and t.tgfoid='private.notify_task_activity()'::regprocedure)<>2 then raise exception 'Extra task notification/activity triggers';end if;
 if (select count(*) from pg_class c where c.oid in ('public.project_activities'::regclass,'public.project_discussion_comments'::regclass) and c.relrowsecurity)<>2 then raise exception 'RLS missing';end if;
 execute 'set local role authenticated';perform set_config('request.jwt.claims',json_build_object('sub',v_users[1],'role','authenticated')::text,true);
 perform public.delete_project(v_p);
 execute 'set local role postgres';
 if exists(select 1 from public.project_activities a where a.project_id=v_p) or exists(select 1 from public.project_discussion_comments d where d.project_id=v_p) or exists(select 1 from public.notifications n where n.project_id=v_p) then raise exception 'Project deletion did not cascade';end if;
end; $test$;
select 'PASS: project activity/discussion assertions completed; fixtures will roll back' as result;
rollback;
select 'ROLLBACK completed; accept results only when the ENTIRE script completed without errors' as result;
