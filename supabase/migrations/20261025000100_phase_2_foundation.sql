-- Apply once to a reviewed Supabase database. No application seed data.
begin;

-- Definer functions and tables must have a trusted, deterministic owner.
-- Supabase SQL Editor and normal database migrations run as postgres.
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run this migration as the trusted postgres database owner';
  end if;
end; $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '' check (char_length(display_name) <= 200),
  created_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 20000),
  due_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('leader', 'member')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create unique index project_one_leader on public.project_members(project_id) where role = 'leader';
create index project_members_user on public.project_members(user_id);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (project_id, id)
);
create index sections_project_position on public.sections(project_id, position);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 20000),
  guidance text not null default '' check (char_length(guidance) <= 20000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  assignee_id uuid,
  due_at timestamptz,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, section_id) references public.sections(project_id, id) on delete cascade,
  foreign key (project_id, assignee_id) references public.project_members(project_id, user_id) on delete restrict
);
create index tasks_section_position on public.tasks(project_id, section_id, position);
create index tasks_assignee_due on public.tasks(assignee_id, due_at);
create index tasks_project_due on public.tasks(project_id, due_at);
create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  is_completed boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade
);
create index task_steps_order on public.task_steps(project_id, task_id, position);
create table public.task_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  url text not null check (char_length(url) <= 2048 and url ~ '^https?://[^[:space:]/?#]+[^[:space:]]*$'),
  description text not null default '' check (char_length(description) <= 20000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade
);
create index task_resources_order on public.task_resources(project_id, task_id, position);
create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (project_id, user_id) references public.project_members(project_id, user_id) on delete cascade
);
create index availability_project_start on public.availability_slots(project_id, starts_at);
create index availability_owner on public.availability_slots(project_id, user_id);
comment on table public.availability_slots is
  'Project-scoped time ranges the member reports as AVAILABLE (free time). Missing slots do not assert busy time. Overlap finds common free time.';
comment on column public.availability_slots.starts_at is 'Inclusive start of available time; timestamptz stores an instant, displayed in the viewer timezone.';
comment on column public.availability_slots.ends_at is 'Exclusive end of available time; must be strictly after starts_at. Overnight ranges are valid.';

-- Helpers are outside the exposed public schema and do not recurse through RLS.
create function private.is_project_member(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.project_members where project_id = p_project_id and user_id = (select auth.uid())
  );
$$;
create function private.is_project_leader(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.project_members where project_id = p_project_id and user_id = (select auth.uid()) and role = 'leader'
  );
$$;
revoke all on function private.is_project_member(uuid), private.is_project_leader(uuid) from public, anon, authenticated;
grant execute on function private.is_project_member(uuid), private.is_project_leader(uuid) to authenticated;

-- Auth owns email and identity. Metadata is only used as display text, never as a role.
create function private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, display_name)
  values (new.id, lower(new.email), left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 200))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function private.sync_profile() from public, anon, authenticated;
create trigger taskflow_sync_profile after insert or update of email on auth.users
for each row execute function private.sync_profile();
-- Provision existing registered accounts too; this never grants membership.
insert into public.profiles(id, email, display_name)
select id, lower(email), left(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''), 200) from auth.users;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.task_steps enable row level security;
alter table public.task_resources enable row level security;
alter table public.availability_slots enable row level security;

-- Explicit grants override Supabase defaults. Membership and project creation/deletion
-- are RPC-only; column grants prevent changing creator/identity/role fields.
revoke all on public.profiles, public.projects, public.project_members, public.sections,
  public.tasks, public.task_steps, public.task_resources, public.availability_slots from public, anon, authenticated;
grant select on public.profiles, public.projects, public.project_members to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(name, description, due_date) on public.projects to authenticated;
grant select, insert, update, delete on public.sections, public.tasks, public.task_steps,
  public.task_resources, public.availability_slots to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Do not broaden profiles_read_self: a row policy cannot hide the email column.
-- This read-only projection exposes only the roster of the requested project,
-- after checking the caller's live membership. No caller/user ID is accepted.
create function public.get_project_member_display(p_project_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_project_member(p_project_id) then
    raise exception 'Project membership required' using errcode = '42501';
  end if;
  return query
    select pm.user_id, p.display_name
    from public.project_members as pm
    join public.profiles as p on p.id = pm.user_id
    where pm.project_id = p_project_id
    order by p.display_name, pm.user_id;
end;
$$;
revoke all on function public.get_project_member_display(uuid) from public, anon, authenticated;
grant execute on function public.get_project_member_display(uuid) to authenticated;
create policy projects_read_member on public.projects for select to authenticated using (private.is_project_member(id));
create policy projects_update_member on public.projects for update to authenticated using (private.is_project_member(id)) with check (private.is_project_member(id));
create policy membership_read_member on public.project_members for select to authenticated using (private.is_project_member(project_id));
create policy sections_member on public.sections for all to authenticated using (private.is_project_member(project_id)) with check (private.is_project_member(project_id));
create policy tasks_member on public.tasks for all to authenticated using (private.is_project_member(project_id)) with check (private.is_project_member(project_id));
create policy steps_member on public.task_steps for all to authenticated using (private.is_project_member(project_id)) with check (private.is_project_member(project_id));
create policy resources_member on public.task_resources for all to authenticated using (private.is_project_member(project_id)) with check (private.is_project_member(project_id));
create policy availability_read_member on public.availability_slots for select to authenticated using (private.is_project_member(project_id));
create policy availability_insert_own on public.availability_slots for insert to authenticated with check (user_id = (select auth.uid()) and private.is_project_member(project_id));
create policy availability_update_own on public.availability_slots for update to authenticated using (user_id = (select auth.uid()) and private.is_project_member(project_id)) with check (user_id = (select auth.uid()) and private.is_project_member(project_id));
create policy availability_delete_own on public.availability_slots for delete to authenticated using (user_id = (select auth.uid()) and private.is_project_member(project_id));

create function public.create_project(p_name text, p_description text default '', p_due_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.projects(name, description, due_date, created_by)
    values (btrim(p_name), coalesce(p_description, ''), p_due_date, v_actor) returning id into v_id;
  insert into public.project_members(project_id, user_id, role) values (v_id, v_actor, 'leader');
  return v_id;
end;
$$;
create function public.add_project_member_by_email(p_project_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.is_project_leader(p_project_id) then raise exception 'Project leader required' using errcode = '42501'; end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not private.is_project_leader(p_project_id) then raise exception 'Project leader required' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if v_user is null then raise exception 'Member could not be added' using errcode = '22023'; end if;
  insert into public.project_members(project_id, user_id, role) values (p_project_id, v_user, 'member') on conflict do nothing;
end;
$$;
create function public.remove_project_member(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.is_project_leader(p_project_id) then raise exception 'Project leader required' using errcode = '42501'; end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not private.is_project_leader(p_project_id) then raise exception 'Project leader required' using errcode = '42501'; end if;
  -- Lock membership before cleanup; concurrent FK references cannot slip past removal.
  perform 1 from public.project_members where project_id = p_project_id and user_id = p_user_id for update;
  if exists (select 1 from public.project_members where project_id = p_project_id and user_id = p_user_id and role = 'leader') then
    raise exception 'The project must retain its leader' using errcode = '22023';
  end if;
  update public.tasks set assignee_id = null where project_id = p_project_id and assignee_id = p_user_id;
  delete from public.availability_slots where project_id = p_project_id and user_id = p_user_id;
  delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
end;
$$;
create function public.delete_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.is_project_leader(p_project_id) then raise exception 'Project leader required' using errcode = '42501'; end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not private.is_project_leader(p_project_id) then raise exception 'Project leader required' using errcode = '42501'; end if;
  -- Clear RESTRICT references before membership cascades; every write is atomic.
  update public.tasks set assignee_id = null where project_id = p_project_id;
  delete from public.projects where id = p_project_id;
end;
$$;
revoke all on function public.create_project(text, text, date), public.add_project_member_by_email(uuid, text),
  public.remove_project_member(uuid, uuid), public.delete_project(uuid) from public, anon, authenticated;
grant execute on function public.create_project(text, text, date), public.add_project_member_by_email(uuid, text),
  public.remove_project_member(uuid, uuid), public.delete_project(uuid) to authenticated;

commit;
