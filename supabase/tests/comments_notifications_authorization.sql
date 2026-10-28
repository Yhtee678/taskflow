-- NOT EXECUTED. SQL Editor: confirm a disposable project, select postgres,
-- paste/run the ENTIRE file after the collaboration migration. Never COMMIT.
-- Owner/catalog inspections validate generation; runtime-role checks validate
-- RLS. Claims simulate verified JWT payloads, not actual Google/API transport.
begin;
set local row_security=on;
set local statement_timeout='60s';
do $test$
declare
 users uuid[]:=array[]::uuid[]; emails text[]:=array[]::text[];
 run_id text:=gen_random_uuid()::text; i integer; p uuid; other_p uuid;
 section_id uuid:=gen_random_uuid(); other_section uuid:=gen_random_uuid();
 v_task_id uuid:=gen_random_uuid(); other_task uuid:=gen_random_uuid();
 comment_id uuid; own_comment uuid; notification_id uuid; baseline bigint;
 edge_task uuid:=gen_random_uuid(); future_task uuid:=gen_random_uuid(); overdue_task uuid:=gen_random_uuid(); done_task uuid:=gen_random_uuid();
 reminder_time timestamptz:=statement_timestamp()+interval '12 hours';
 signature text; expected_client boolean;
begin
 if current_user<>'postgres' then raise exception 'Run as postgres on a disposable project';end if;
 for i in 1..4 loop
  users:=array_append(users,gen_random_uuid());emails:=array_append(emails,'collaboration-'||run_id||'-'||i||'@example.test');
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(users[i],emails[i],now(),jsonb_build_object('full_name','Member '||i));
 end loop;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','',true);
 perform set_config('request.jwt.claims',json_build_object('sub',users[1],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if current_user<>'authenticated' or auth.uid()<>users[1] or (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) then raise exception 'Runtime identity simulation failed';end if;
 p:=public.create_project('Collaboration test '||run_id);
 perform public.add_project_member_by_email(p,emails[2]);perform public.add_project_member_by_email(p,emails[3]);
 insert into public.sections(id,project_id,name) values(section_id,p,'Test');
 insert into public.tasks(id,project_id,section_id,title,assignee_id,due_at) values(v_task_id,p,section_id,'Discussion task',users[1],reminder_time);
 if exists(select 1 from public.notifications) then raise exception 'Self-assignment notified actor';end if;
 update public.tasks set assignee_id=users[2] where id=v_task_id;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.task_id=v_task_id)<>1 then
  raise exception 'Assignment should notify exactly one recipient';
 end if;
 if not exists(select 1 from public.notifications n where n.task_id=v_task_id and n.user_id=users[2] and n.kind='task_assigned' and n.actor_id=users[1]) then raise exception 'Wrong assignment recipient';end if;
 select count(*) into baseline from public.notifications n where n.project_id=p;
 execute 'set local role authenticated';
 update public.tasks t set title='Renamed',priority='high',description='Unrelated edit' where t.id=v_task_id;
 update public.tasks t set assignee_id=users[2] where t.id=v_task_id;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.project_id=p)<>baseline then raise exception 'Unrelated/no-op edit generated notifications';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',json_build_object('sub',users[2],'role','authenticated')::text,true);
 update public.tasks t set status='in_progress' where t.id=v_task_id;
 update public.tasks t set status='done' where t.id=v_task_id;
 update public.tasks t set status='done' where t.id=v_task_id;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.task_id=v_task_id and n.kind='task_completed')<>2 or exists(select 1 from public.notifications n where n.task_id=v_task_id and n.kind='task_completed' and n.user_id=users[2]) then raise exception 'Completion duplicated or notified actor';end if;
 if (select count(*) from public.notifications n where n.task_id=v_task_id and n.kind='task_status_changed')<>2 or exists(select 1 from public.notifications n where n.task_id=v_task_id and n.kind='task_status_changed' and n.task_status='done') then raise exception 'Completion also emitted generic status notification';end if;
 execute 'set local role authenticated';
 insert into public.task_comments(project_id,task_id,body) values(p,v_task_id,'My removable comment') returning id into own_comment;
 delete from public.task_comments c where c.id=own_comment;
 if not found then raise exception 'Author cannot delete own comment';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',users[3],'role','authenticated')::text,true);
 insert into public.task_comments(project_id,task_id,body) values(p,v_task_id,'Help with this task') returning id into comment_id;
 if not exists(select 1 from public.task_comments c where c.id=comment_id and c.author_id=users[3] and c.author_name='Member 3') then raise exception 'Comment attribution failed';end if;
 begin insert into public.task_comments(project_id,task_id,body,author_id) values(p,v_task_id,'Forged',users[1]);raise exception 'Author impersonation succeeded';exception when insufficient_privilege then null;end;
 begin insert into public.task_comments(project_id,task_id,body,author_name) values(p,v_task_id,'Forged','Leader');raise exception 'Name impersonation succeeded';exception when insufficient_privilege then null;end;
 begin update public.task_comments c set body='Edited' where c.id=comment_id;raise exception 'Comment editing allowed';exception when insufficient_privilege then null;end;
 begin insert into public.task_comments(project_id,task_id,body) values(p,v_task_id,'  ');raise exception 'Blank comment accepted';exception when check_violation then null;end;
 execute 'set local role postgres';
 -- Two comment insertions, each delivered to the two OTHER current members.
 if (select count(*) from public.notifications n where n.task_id=v_task_id and n.kind='comment_added')<>4 then raise exception 'Comment recipients incorrect';end if;
 if exists(select 1 from public.notifications n where n.kind='comment_added' and n.user_id=n.actor_id) then raise exception 'Comment actor notified';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',json_build_object('sub',users[1],'role','authenticated')::text,true);
 delete from public.task_comments c where c.id=comment_id;
 if found then raise exception 'Leader deleted another author comment';end if;
 update public.tasks t set due_at=reminder_time+interval '1 hour',status='todo' where t.id=v_task_id;
 execute 'set local role postgres';
 if (select count(*) from public.notifications n where n.task_id=v_task_id and n.kind='deadline_changed')<>2 or exists(select 1 from public.notifications n where n.task_id=v_task_id and n.kind='deadline_changed' and n.user_id=users[1]) then raise exception 'Deadline change recipients incorrect';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',json_build_object('sub',users[2],'role','authenticated')::text,true);
 if public.refresh_deadline_reminders()<>1 or public.refresh_deadline_reminders()<>0 then raise exception 'Deadline reminders not deduplicated';end if;
 select n.id into notification_id from public.notifications n where n.kind='deadline_approaching' and n.task_id=v_task_id;
 update public.notifications n set read_at=statement_timestamp() where n.id=notification_id;
 if not exists(select 1 from public.notifications n where n.id=notification_id and n.read_at is not null) or public.refresh_deadline_reminders()<>0 then raise exception 'Read state/reminder persistence failed';end if;
 begin insert into public.notifications(user_id,project_id,task_id,kind) values(users[1],p,v_task_id,'task_completed');raise exception 'Arbitrary notification insertion succeeded';exception when insufficient_privilege then null;end;
 begin update public.notifications n set user_id=users[1] where n.id=notification_id;raise exception 'Notification ownership changed';exception when insufficient_privilege then null;end;
 begin delete from public.notifications n where n.id=notification_id;raise exception 'Notification deletion allowed';exception when insufficient_privilege then null;end;
 -- Distinct deadline generates one new reminder; same deadline never repeats.
 update public.tasks t set due_at=reminder_time+interval '2 hours' where t.id=v_task_id;
 if public.refresh_deadline_reminders()<>1 then raise exception 'Changed deadline missing new reminder';end if;
 update public.tasks t set due_at=reminder_time+interval '1 hour' where t.id=v_task_id;
 if public.refresh_deadline_reminders()<>0 then raise exception 'Returning to same deadline duplicated reminder';end if;
 insert into public.tasks(id,project_id,section_id,title,assignee_id,status,due_at) values
 (edge_task,p,section_id,'Exactly 24 hours',users[2],'todo',statement_timestamp()+interval '24 hours'),
 (future_task,p,section_id,'Beyond 24 hours',users[2],'todo',statement_timestamp()+interval '24 hours 1 minute'),
 (overdue_task,p,section_id,'Overdue',users[2],'todo',statement_timestamp()-interval '1 minute'),
 (done_task,p,section_id,'Already done',users[2],'done',statement_timestamp()+interval '1 hour');
 if public.refresh_deadline_reminders()<>1 then raise exception '24-hour/status boundary incorrect';end if;
 if exists(select 1 from public.notifications n where n.kind='deadline_approaching' and n.task_id in(future_task,overdue_task,done_task)) then raise exception 'Out-of-window/completed task reminded';end if;
 -- Other users cannot access this recipient's read state.
 perform set_config('request.jwt.claims',json_build_object('sub',users[3],'role','authenticated')::text,true);
 if exists(select 1 from public.notifications n where n.id=notification_id) then raise exception 'Peer can read another inbox';end if;
 update public.notifications n set read_at=now() where n.id=notification_id;
 if found then raise exception 'Peer can change another inbox';end if;
 -- An unrelated project does not authorize guessed task/comment IDs.
 perform set_config('request.jwt.claims',json_build_object('sub',users[4],'role','authenticated')::text,true);
 other_p:=public.create_project('Unrelated project '||run_id);
 insert into public.sections(id,project_id,name) values(other_section,other_p,'Other');
 insert into public.tasks(id,project_id,section_id,title) values(other_task,other_p,other_section,'Other task');
 if exists(select 1 from public.task_comments c where c.id=comment_id) or exists(select 1 from public.notifications) then raise exception 'Cross-project read leak';end if;
 begin insert into public.task_comments(project_id,task_id,body) values(p,v_task_id,'Unauthorized');raise exception 'Non-member comment accepted';exception when insufficient_privilege then null;end;
 begin insert into public.task_comments(project_id,task_id,body) values(other_p,v_task_id,'Wrong parent');raise exception 'Cross-project comment accepted';exception when foreign_key_violation then null;end;
 -- Remove a member using the unchanged RPC, then verify runtime RLS and purge.
 perform set_config('request.jwt.claims',json_build_object('sub',users[1],'role','authenticated')::text,true);
 perform public.remove_project_member(p,users[2]);
 perform set_config('request.jwt.claims',json_build_object('sub',users[2],'role','authenticated')::text,true);
 if exists(select 1 from public.task_comments c where c.project_id=p) or exists(select 1 from public.notifications n where n.project_id=p) then raise exception 'Removed member retained access';end if;
 if public.refresh_deadline_reminders()<>0 then raise exception 'Removed member generated reminders';end if;
 begin insert into public.task_comments(project_id,task_id,body) values(p,v_task_id,'After removal');raise exception 'Removed member commented';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform public.refresh_deadline_reminders();raise exception 'Missing identity reminder succeeded';exception when insufficient_privilege then null;end;
 execute 'set local role anon';perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform * from public.task_comments;raise exception 'Anonymous comments accessible';exception when insufficient_privilege then null;end;
 begin perform * from public.notifications;raise exception 'Anonymous notifications accessible';exception when insufficient_privilege then null;end;
 begin perform public.refresh_deadline_reminders();raise exception 'Anonymous reminder RPC accessible';exception when insufficient_privilege then null;end;
 execute 'set local role postgres';
 if exists(select 1 from public.notifications n where n.project_id=p and n.user_id=users[2]) then raise exception 'Removal did not purge inbox';end if;
 for signature,expected_client in select * from (values ('private.prepare_task_comment()',false),('private.notify_task_comment()',false),('private.notify_task_activity()',false),('public.refresh_deadline_reminders()',true)) expected(signature,client_execute) loop
  if not exists(select 1 from pg_proc f where f.oid=signature::regprocedure and f.prosecdef and pg_get_userbyid(f.proowner)='postgres' and f.proconfig @> array['search_path=""']) then raise exception 'Unsafe function %',signature;end if;
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')<>expected_client then raise exception 'Unsafe execute grants %',signature;end if;
 end loop;
 if (select count(*) from pg_class c where c.oid in ('public.task_comments'::regclass,'public.notifications'::regclass) and c.relrowsecurity)<>2 then raise exception 'Missing RLS';end if;
end; $test$;
select 'PASS: collaboration assertions completed; synthetic fixtures will roll back' as result;
rollback;
select 'ROLLBACK completed; accept results only when the ENTIRE file completed without errors' as result;
