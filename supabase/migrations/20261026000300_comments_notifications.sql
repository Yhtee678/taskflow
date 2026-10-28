-- Additive, owner-requested collaboration feature. Run the WHOLE file manually
-- as postgres after the existing migrations. No existing policy/function is replaced.
begin;
do $$ begin if current_user <> 'postgres' then raise exception 'Run as postgres'; end if; end; $$;

create table public.task_comments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid not null,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 author_name text not null default '',
 body text not null check (char_length(btrim(body)) between 1 and 20000),
 created_at timestamptz not null default statement_timestamp(),
 foreign key (project_id,task_id) references public.tasks(project_id,id) on delete cascade
);
create index task_comments_order on public.task_comments(project_id,task_id,created_at,id);
alter table public.task_comments enable row level security;
revoke all on public.task_comments from public,anon,authenticated;
grant select,delete on public.task_comments to authenticated;
grant insert(project_id,task_id,body) on public.task_comments to authenticated;
create policy comments_read_member on public.task_comments for select to authenticated using (private.is_project_member(project_id));
create policy comments_insert_member on public.task_comments for insert to authenticated with check (author_id=(select auth.uid()) and private.is_project_member(project_id));
create policy comments_delete_own on public.task_comments for delete to authenticated using (author_id=(select auth.uid()) and private.is_project_member(project_id));

-- A minimal author-name snapshot keeps past comments attributable after removal
-- without opening private profiles. Clients cannot supply author/name/time/id.
create function private.prepare_task_comment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.author_id is distinct from auth.uid() or not private.is_project_member(new.project_id) then
  raise exception 'Project membership and own identity required' using errcode='42501';
 end if;
 select coalesce(nullif(btrim(p.display_name),''),'Project member') into new.author_name from public.profiles p where p.id=auth.uid();
 new.created_at:=statement_timestamp();
 return new;
end; $$;
revoke all on function private.prepare_task_comment() from public,anon,authenticated;
create trigger prepare_task_comment before insert on public.task_comments for each row execute function private.prepare_task_comment();

create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid not null,
 actor_id uuid references public.profiles(id) on delete set null,
 actor_name text not null default '',
 kind text not null check (kind in ('task_assigned','task_status_changed','task_completed','comment_added','deadline_changed','deadline_approaching')),
 task_status text check (task_status in ('todo','in_progress','done')),
 deadline_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 read_at timestamptz check (read_at is null or isfinite(read_at)),
 foreign key (project_id,task_id) references public.tasks(project_id,id) on delete cascade,
 -- Removal deletes the recipient's project notifications; rejoining cannot
 -- resurrect the old inbox. Existing removal RPC requires no modification.
 foreign key (project_id,user_id) references public.project_members(project_id,user_id) on delete cascade,
 check (kind<>'deadline_approaching' or (deadline_at is not null and actor_id is null))
);
create index notifications_inbox on public.notifications(user_id,created_at desc,id);
create index notifications_project_task on public.notifications(project_id,task_id);
create unique index notifications_reminder_once on public.notifications(user_id,task_id,deadline_at) where kind='deadline_approaching';
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy notifications_read_own_member on public.notifications for select to authenticated using (user_id=(select auth.uid()) and private.is_project_member(project_id));
create policy notifications_update_own_member on public.notifications for update to authenticated using (user_id=(select auth.uid()) and private.is_project_member(project_id)) with check (user_id=(select auth.uid()) and private.is_project_member(project_id));

create function private.notify_task_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_name text;
begin
 -- Administrative maintenance without an authenticated actor is not user activity.
 if v_actor is null then return new; end if;
 if not private.is_project_member(new.project_id) then raise exception 'Project membership required' using errcode='42501'; end if;
 select coalesce(nullif(btrim(p.display_name),''),'A project member') into v_name from public.profiles p where p.id=v_actor;
 if tg_op='INSERT' then
  if new.assignee_id is not null and new.assignee_id<>v_actor then
   insert into public.notifications(user_id,project_id,task_id,actor_id,actor_name,kind)
   select m.user_id,new.project_id,new.id,v_actor,v_name,'task_assigned' from public.project_members m where m.project_id=new.project_id and m.user_id=new.assignee_id;
  end if;
  return new;
 end if;
 if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null and new.assignee_id<>v_actor then
  insert into public.notifications(user_id,project_id,task_id,actor_id,actor_name,kind)
  select m.user_id,new.project_id,new.id,v_actor,v_name,'task_assigned' from public.project_members m where m.project_id=new.project_id and m.user_id=new.assignee_id;
 end if;
 if new.status is distinct from old.status then
  insert into public.notifications(user_id,project_id,task_id,actor_id,actor_name,kind,task_status)
  select m.user_id,new.project_id,new.id,v_actor,v_name,case when new.status='done' then 'task_completed' else 'task_status_changed' end,new.status
  from public.project_members m where m.project_id=new.project_id and m.user_id<>v_actor;
 end if;
 if new.due_at is distinct from old.due_at then
  insert into public.notifications(user_id,project_id,task_id,actor_id,actor_name,kind,deadline_at)
  select m.user_id,new.project_id,new.id,v_actor,v_name,'deadline_changed',new.due_at from public.project_members m where m.project_id=new.project_id and m.user_id<>v_actor;
 end if;
 return new;
end; $$;
revoke all on function private.notify_task_activity() from public,anon,authenticated;
create trigger notify_task_insert after insert on public.tasks for each row execute function private.notify_task_activity();
create trigger notify_task_update after update of assignee_id,status,due_at on public.tasks for each row
 when (old.assignee_id is distinct from new.assignee_id or old.status is distinct from new.status or old.due_at is distinct from new.due_at)
 execute function private.notify_task_activity();

create function private.notify_task_comment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.author_id is distinct from auth.uid() or not private.is_project_member(new.project_id) then raise exception 'Project membership required' using errcode='42501'; end if;
 insert into public.notifications(user_id,project_id,task_id,actor_id,actor_name,kind)
 select m.user_id,new.project_id,new.task_id,new.author_id,new.author_name,'comment_added' from public.project_members m where m.project_id=new.project_id and m.user_id<>new.author_id;
 return new;
end; $$;
revoke all on function private.notify_task_comment() from public,anon,authenticated;
create trigger notify_task_comment after insert on public.task_comments for each row execute function private.notify_task_comment();

-- Caller supplies no identity, recipient, deadline or task ID. No cron/services.
create function public.refresh_deadline_reminders() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into public.notifications(user_id,project_id,task_id,kind,deadline_at)
 select auth.uid(),t.project_id,t.id,'deadline_approaching',t.due_at
 from public.tasks t join public.project_members m on m.project_id=t.project_id and m.user_id=auth.uid()
 where t.assignee_id=auth.uid() and t.status<>'done' and t.due_at>statement_timestamp() and t.due_at<=statement_timestamp()+interval '24 hours'
 on conflict (user_id,task_id,deadline_at) where kind='deadline_approaching' do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end; $$;
revoke all on function public.refresh_deadline_reminders() from public,anon,authenticated;
grant execute on function public.refresh_deadline_reminders() to authenticated;
notify pgrst,'reload schema';
commit;
