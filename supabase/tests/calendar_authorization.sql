-- NOT EXECUTED. Run the WHOLE file as postgres in SQL Editor on a disposable
-- project after Phase 2, Phase 3, and the Calendar migration. Never COMMIT.
begin;
set local statement_timeout='60s';
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 project_id uuid; event_id uuid; daily_id uuid; weekly_id uuid;
 run_id text:=gen_random_uuid()::text;
begin
 if current_user<>'postgres' then raise exception 'Run as postgres on a disposable project'; end if;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (a,'calendar-a-'||run_id||'@example.test',now(),'{}'),(b,'calendar-b-'||run_id||'@example.test',now(),'{}'),(c,'calendar-c-'||run_id||'@example.test',now(),'{}');
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claim.role','',true);
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if auth.uid()<>a or current_user<>'authenticated' or (select rolbypassrls or rolsuper from pg_roles where rolname=current_user) then raise exception 'Identity simulation failed';end if;
 project_id:=public.create_project('Calendar rollback test '||run_id);
 perform public.add_project_member_by_email(project_id,'calendar-b-'||run_id||'@example.test');
 insert into public.busy_events(user_id,title,category,description,starts_at,ends_at,time_zone)
 values(a,'Private title','exam','Private description','2026-10-31T23:00:00+08','2026-11-01T01:00:00+08','Asia/Kuala_Lumpur') returning id into event_id;
 insert into public.busy_events(user_id,title,category,starts_at,ends_at,recurrence,time_zone)
 values(a,'DST daily','class','2026-03-07T09:00:00-05','2026-03-07T10:00:00-05','daily','America/New_York') returning id into daily_id;
 insert into public.busy_events(user_id,title,category,starts_at,ends_at,recurrence,time_zone)
 values(a,'Weekly overnight','study','2026-10-26T23:00:00+08','2026-10-27T01:00:00+08','weekly','Asia/Kuala_Lumpur') returning id into weekly_id;
 if not exists(select 1 from public.get_own_busy_occurrences('2026-03-08T00:00:00Z','2026-03-09T00:00:00Z') o where o.event_id=daily_id and o.starts_at='2026-03-08T13:00:00Z'::timestamptz and o.ends_at='2026-03-08T14:00:00Z'::timestamptz) then raise exception 'Daily recurrence did not retain local time across DST';end if;
 if (select count(*) from public.get_own_busy_occurrences('2026-11-02T00:00:00+08','2026-11-04T00:00:00+08') o where o.event_id=weekly_id)<>1 then raise exception 'Weekly recurrence crossed dates incorrectly';end if;
 if not exists(select 1 from public.get_own_busy_occurrences('2026-11-01T00:00:00+08','2026-11-02T00:00:00+08') o where o.event_id=event_id and o.starts_at='2026-11-01T00:00:00+08'::timestamptz and o.ends_at='2026-11-01T01:00:00+08'::timestamptz) then raise exception 'Overnight clipping failed';end if;
 if exists(select 1 from public.get_own_busy_occurrences('2026-11-01T01:00:00+08','2026-11-01T02:00:00+08') o where o.event_id=event_id) then raise exception 'Exclusive end incorrectly overlaps';end if;
 insert into public.busy_events(user_id,title,category,starts_at,ends_at,time_zone)
 values(a,'Private overlapping event','personal','2026-10-31T23:30:00+08','2026-11-01T00:30:00+08','Asia/Kuala_Lumpur');
 if (select count(*) from public.get_project_busy_periods(project_id,'2026-10-31T23:00:00+08','2026-11-01T01:00:00+08'))<>1 then raise exception 'Team API exposes overlapping private event boundaries';end if;
 update public.busy_events set title='Edited whole series',starts_at='2026-10-26T22:00:00+08',ends_at='2026-10-27T00:00:00+08' where id=weekly_id;
 if not exists(select 1 from public.get_own_busy_occurrences('2026-11-02T00:00:00+08','2026-11-04T00:00:00+08') o where o.event_id=weekly_id and o.starts_at='2026-11-02T22:00:00+08'::timestamptz) then raise exception 'Series edit did not affect future occurrences';end if;
 delete from public.busy_events where id=weekly_id;
 if exists(select 1 from public.get_own_busy_occurrences('2026-11-02T00:00:00+08','2026-11-04T00:00:00+08') o where o.event_id=weekly_id) then raise exception 'Deleted series still generates occurrences';end if;
 begin insert into public.busy_events(user_id,title,category,starts_at,ends_at,time_zone) values(a,'Bad zone','other',now(),now()+interval '1 hour','Invalid/Zone');raise exception 'Invalid zone accepted';exception when check_violation then null;end;
 begin insert into public.busy_events(user_id,title,category,starts_at,ends_at,time_zone) values(b,'Impersonation','other',now(),now()+interval '1 hour','UTC');raise exception 'Peer insertion accepted';exception when insufficient_privilege then null;end;
 begin update public.busy_events set user_id=b where id=event_id;raise exception 'Owner transfer accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
 if exists(select 1 from public.busy_events) then raise exception 'Peer can read private events';end if;
 if (select array_agg(k order by k) from (select distinct jsonb_object_keys(to_jsonb(p)) as k from public.get_project_busy_periods(project_id,'2026-10-31T00:00:00+08','2026-11-02T00:00:00+08') p) keys) is distinct from array['ends_at','starts_at','user_id']::text[] then raise exception 'Team API leaked fields or returned no occupancy';end if;
 update public.busy_events set title='Hacked' where id=event_id;
 if found then raise exception 'Peer event update succeeded';end if;
 delete from public.busy_events where id=event_id;
 if found then raise exception 'Peer event delete succeeded';end if;
 if exists(select 1 from public.get_own_busy_occurrences('2026-10-01','2026-12-01')) then raise exception 'Own RPC leaked teammate event IDs';end if;
 begin perform * from private.busy_occurrences(array[a],'2026-10-01','2026-12-01');raise exception 'Runtime caller invoked private helper';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);
 begin perform * from public.get_project_busy_periods(project_id,'2026-10-01','2026-12-01');raise exception 'Unrelated user read team occupancy';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 perform public.remove_project_member(project_id,b);
 perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
 begin perform * from public.get_project_busy_periods(project_id,'2026-10-01','2026-12-01');raise exception 'Removed member retained occupancy access';exception when insufficient_privilege then null;end;
 execute 'set local role anon';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform * from public.busy_events;raise exception 'Anonymous event read succeeded';exception when insufficient_privilege then null;end;
 begin perform * from public.get_own_busy_occurrences('2026-10-01','2026-12-01');raise exception 'Anonymous RPC succeeded';exception when insufficient_privilege then null;end;
 execute 'set local role postgres';
 if not exists(select 1 from public.busy_events where id=event_id and title='Private title') then raise exception 'Peer write altered event';end if;
 if exists(select 1 from pg_proc where oid in ('public.get_own_busy_occurrences(timestamptz,timestamptz)'::regprocedure,'public.get_project_busy_periods(uuid,timestamptz,timestamptz)'::regprocedure) and (not prosecdef or pg_get_userbyid(proowner)<>'postgres' or not coalesce(proconfig @> array['search_path=""'],false))) then raise exception 'Unsafe function ownership/search_path';end if;
 if has_function_privilege('authenticated','private.busy_occurrences(uuid[],timestamptz,timestamptz)','EXECUTE') or has_function_privilege('anon','public.get_project_busy_periods(uuid,timestamptz,timestamptz)','EXECUTE') then raise exception 'Unsafe grants';end if;
end; $test$;
select 'PASS: Calendar assertions completed; all fixtures will roll back' as result;
rollback;
-- Accept PASS only if the entire file completed without errors.
select 'ROLLBACK completed; no test writes committed' as result;
