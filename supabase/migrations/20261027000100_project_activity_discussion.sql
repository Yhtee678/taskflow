-- Run the WHOLE file manually as postgres after 20261026000300. Existing
-- migration files/data/policies remain intact. This replaces only notification
-- trigger bodies to use a single shared event recorder and notification fanout.
begin;
do $$ begin if current_user<>'postgres' then raise exception 'Run as postgres';end if;end; $$;

create table public.project_discussion_comments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 author_name text not null default '',
 body text not null check (char_length(btrim(body)) between 1 and 20000),
 created_at timestamptz not null default statement_timestamp()
);
create index project_discussion_order on public.project_discussion_comments(project_id,created_at,id);
alter table public.project_discussion_comments enable row level security;
revoke all on public.project_discussion_comments from public,anon,authenticated;
grant select,delete on public.project_discussion_comments to authenticated;
grant insert(project_id,body) on public.project_discussion_comments to authenticated;
create policy discussion_read_member on public.project_discussion_comments for select to authenticated using(private.is_project_member(project_id));
create policy discussion_insert_member on public.project_discussion_comments for insert to authenticated with check(author_id=(select auth.uid()) and private.is_project_member(project_id));
create policy discussion_delete_own on public.project_discussion_comments for delete to authenticated using(author_id=(select auth.uid()) and private.is_project_member(project_id));
-- Reuse the existing identity/name preparer: it depends only on project_id,
-- author_id, author_name and created_at. Task Comments behavior is unchanged.
create trigger prepare_project_discussion before insert on public.project_discussion_comments for each row execute function private.prepare_task_comment();

create table public.project_activities (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 -- Preserve history when a task is deleted. The private recorder validates the
-- task/project relationship; no client can insert or change activity fields.
 task_id uuid references public.tasks(id) on delete set null,
 task_title text not null default '',
 actor_id uuid references public.profiles(id) on delete set null,
 actor_name text not null,
 kind text not null check(kind in ('task_created','task_assigned','task_reassigned','task_status_changed','task_completed','deadline_changed','comment_added','discussion_added')),
 task_status text check(task_status in ('todo','in_progress','done')),
 deadline_at timestamptz,
 assignee_name text not null default '',
 created_at timestamptz not null default statement_timestamp()
);
create index project_activity_recent on public.project_activities(project_id,created_at desc,id desc);
create index project_activity_task on public.project_activities(task_id);
alter table public.project_activities enable row level security;
revoke all on public.project_activities from public,anon,authenticated;
grant select on public.project_activities to authenticated;
create policy activity_read_member on public.project_activities for select to authenticated using(private.is_project_member(project_id));

-- Discussion notifications have a project destination instead of a task. All
-- existing task rows/read states/reminder uniqueness and RLS remain unchanged.
alter table public.notifications alter column task_id drop not null;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in ('task_assigned','task_status_changed','task_completed','comment_added','deadline_changed','deadline_approaching','discussion_added'));
alter table public.notifications add constraint notifications_destination_check check((kind='discussion_added' and task_id is null) or (kind<>'discussion_added' and task_id is not null));
alter table public.notifications add column activity_id uuid references public.project_activities(id) on delete set null;
create unique index notification_activity_once on public.notifications(user_id,activity_id) where activity_id is not null;

create function private.record_project_activity(p_project_id uuid,p_task_id uuid,p_kind text,p_status text default null,p_deadline timestamptz default null,p_assignee uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_name text;v_title text:='';v_assignee_name text:='';v_activity uuid;v_notification_kind text;
begin
 if v_actor is null then return;end if;
 if not private.is_project_member(p_project_id) then raise exception 'Project membership required' using errcode='42501';end if;
 select coalesce(nullif(btrim(p.display_name),''),'A project member') into v_name from public.profiles p where p.id=v_actor;
 if p_kind='discussion_added' then
  if p_task_id is not null then raise exception 'Discussion has no task' using errcode='23514';end if;
 else
  select t.title into v_title from public.tasks t where t.id=p_task_id and t.project_id=p_project_id;
  if not found then raise exception 'Task must belong to project' using errcode='23503';end if;
 end if;
 if p_assignee is not null then
  select coalesce(nullif(btrim(p.display_name),''),'Project member') into v_assignee_name from public.project_members m join public.profiles p on p.id=m.user_id where m.project_id=p_project_id and m.user_id=p_assignee;
  if not found then raise exception 'Assignee must belong to project' using errcode='23503';end if;
 end if;
 insert into public.project_activities(project_id,task_id,task_title,actor_id,actor_name,kind,task_status,deadline_at,assignee_name)
 values(p_project_id,p_task_id,v_title,v_actor,v_name,p_kind,p_status,p_deadline,v_assignee_name) returning id into v_activity;
 if p_kind in ('task_created','task_assigned','task_reassigned') then
  -- Creation is ONE activity, even with an initial assignment, but preserves
  -- the existing assignment notification to a different newly assigned user.
  if p_assignee is null or p_assignee=v_actor then return;end if;
  v_notification_kind:='task_assigned';
 else
  v_notification_kind:=p_kind;
 end if;
 insert into public.notifications(user_id,project_id,task_id,actor_id,actor_name,kind,task_status,deadline_at,activity_id)
 select m.user_id,p_project_id,p_task_id,v_actor,v_name,v_notification_kind,p_status,p_deadline,v_activity
 from public.project_members m where m.project_id=p_project_id and m.user_id<>v_actor
 and (p_kind not in ('task_created','task_assigned','task_reassigned') or m.user_id=p_assignee)
 on conflict(user_id,activity_id) where activity_id is not null do nothing;
end; $$;
revoke all on function private.record_project_activity(uuid,uuid,text,text,timestamptz,uuid) from public,anon,authenticated;

-- Existing task triggers call this body; do NOT add a second set of triggers.
create or replace function private.notify_task_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new;end if;
 if tg_op='INSERT' then
  perform private.record_project_activity(new.project_id,new.id,'task_created',null,null,new.assignee_id);
  return new;
 end if;
 if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
  perform private.record_project_activity(new.project_id,new.id,case when old.assignee_id is null then 'task_assigned' else 'task_reassigned' end,null,null,new.assignee_id);
 end if;
 if new.status is distinct from old.status then
  perform private.record_project_activity(new.project_id,new.id,case when new.status='done' then 'task_completed' else 'task_status_changed' end,new.status);
 end if;
 if new.due_at is distinct from old.due_at then
  perform private.record_project_activity(new.project_id,new.id,'deadline_changed',null,new.due_at);
 end if;
 return new;
end; $$;
revoke all on function private.notify_task_activity() from public,anon,authenticated;

create or replace function private.notify_task_comment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.author_id is distinct from auth.uid() then raise exception 'Own identity required' using errcode='42501';end if;
 perform private.record_project_activity(new.project_id,new.task_id,'comment_added');
 return new;
end; $$;
revoke all on function private.notify_task_comment() from public,anon,authenticated;

create function private.notify_project_discussion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.author_id is distinct from auth.uid() then raise exception 'Own identity required' using errcode='42501';end if;
 perform private.record_project_activity(new.project_id,null,'discussion_added');
 return new;
end; $$;
revoke all on function private.notify_project_discussion() from public,anon,authenticated;
create trigger notify_project_discussion after insert on public.project_discussion_comments for each row execute function private.notify_project_discussion();
notify pgrst,'reload schema';
commit;
