-- Calendar enhancement. Run the whole file manually as postgres, after Phase 3.
-- Existing availability_slots and all existing policies/data are untouched.
begin;
do $$ begin if current_user <> 'postgres' then raise exception 'Run as postgres'; end if; end; $$;

create table public.busy_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 200),
 category text not null check (category in ('class','exam','event','study','personal','other')),
 description text not null default '' check (char_length(description)<=10000),
 starts_at timestamptz not null check (isfinite(starts_at)),
 ends_at timestamptz not null check (isfinite(ends_at)),
 recurrence text not null default 'none' check (recurrence in ('none','daily','weekly')),
 time_zone text not null,
 created_at timestamptz not null default now(),
 check (ends_at>starts_at)
);
create index busy_events_owner_start on public.busy_events(user_id, starts_at);
comment on table public.busy_events is 'Private personal busy series. Daily/weekly recurrence preserves local wall-clock endpoints in time_zone. No occurrence exceptions or stored suggested availability.';

create function private.validate_busy_event() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.time_zone) then
  raise exception 'Use a valid IANA time zone' using errcode='23514';
 end if;
 if new.recurrence<>'none' and (new.ends_at at time zone new.time_zone) <= (new.starts_at at time zone new.time_zone) then
  raise exception 'Recurring end must be after start in local time' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function private.validate_busy_event() from public,anon,authenticated;
create trigger validate_busy_event before insert or update on public.busy_events
for each row execute function private.validate_busy_event();
alter table public.busy_events enable row level security;
revoke all on public.busy_events from public,anon,authenticated;
grant select,delete on public.busy_events to authenticated;
grant insert(user_id,title,category,description,starts_at,ends_at,recurrence,time_zone),
 update(title,category,description,starts_at,ends_at,recurrence,time_zone) on public.busy_events to authenticated;
create policy busy_events_read_own on public.busy_events for select to authenticated using (user_id=(select auth.uid()));
create policy busy_events_insert_own on public.busy_events for insert to authenticated with check (user_id=(select auth.uid()));
create policy busy_events_update_own on public.busy_events for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy busy_events_delete_own on public.busy_events for delete to authenticated using (user_id=(select auth.uid()));

-- No runtime role can invoke this expansion helper or supply arbitrary user IDs.
-- Generate local calendar dates (not fixed 24h/168h increments) so recurrence
-- follows the series time zone across DST and crosses month/year boundaries.
create function private.busy_occurrences(p_users uuid[],p_start timestamptz,p_end timestamptz)
returns table(event_id uuid,user_id uuid,starts_at timestamptz,ends_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 with definitions as (
  select e.*, e.starts_at at time zone e.time_zone as local_start,
         e.ends_at at time zone e.time_zone as local_end
  from public.busy_events e where e.user_id=any(p_users) and e.starts_at<p_end
 ), occurrences as (
  select e.id,e.user_id,e.starts_at,e.ends_at from definitions e where e.recurrence='none'
  union all
  select e.id,e.user_id,t.from_instant,
    case when t.to_instant<=t.from_instant then t.from_instant+(e.local_end-e.local_start) else t.to_instant end
  from definitions e
  cross join lateral pg_catalog.generate_series(
   greatest(e.local_start::date, (p_start at time zone e.time_zone)::date-(e.local_end::date-e.local_start::date)-1)::timestamp,
   (p_end at time zone e.time_zone)::date::timestamp, interval '1 day') as d(day)
  cross join lateral (select
   (d.day::date + e.local_start::time) at time zone e.time_zone as from_instant,
   (d.day::date + (e.local_end::date-e.local_start::date) + e.local_end::time) at time zone e.time_zone as to_instant) t
  where e.recurrence in ('daily','weekly')
    and (e.recurrence='daily' or (d.day::date-e.local_start::date)%7=0)
 )
 select o.id,o.user_id,greatest(o.starts_at,p_start),least(o.ends_at,p_end)
 from occurrences o where o.starts_at<p_end and o.ends_at>p_start and o.starts_at<o.ends_at
 order by o.user_id,o.starts_at,o.id;
$$;
revoke all on function private.busy_occurrences(uuid[],timestamptz,timestamptz) from public,anon,authenticated;

-- Own occurrence IDs allow joining to the owner's RLS-protected definitions.
create function public.get_own_busy_occurrences(p_start timestamptz,p_end timestamptz)
returns table(event_id uuid,starts_at timestamptz,ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start>=p_end then raise exception 'Invalid time window' using errcode='22023'; end if;
 return query select o.event_id,o.starts_at,o.ends_at from private.busy_occurrences(array[auth.uid()],p_start,p_end) o;
end; $$;

-- Project-scoped API discloses NO event ID, title, category, description,
-- recurrence, time zone or creation date. Only occupancy is shared.
create function public.get_project_busy_periods(p_project_id uuid,p_start timestamptz,p_end timestamptz)
returns table(user_id uuid,starts_at timestamptz,ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.is_project_member(p_project_id) then raise exception 'Project membership required' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start>=p_end then raise exception 'Invalid time window' using errcode='22023'; end if;
 -- Union overlapping/adjacent occupancy, so series IDs and event boundaries
 -- cannot be inferred from one row per private event.
 return query
 with raw as (select o.user_id,o.starts_at,o.ends_at from private.busy_occurrences(
  array(select m.user_id from public.project_members m where m.project_id=p_project_id),p_start,p_end) o),
 prior as (select r.*,max(r.ends_at) over(partition by r.user_id order by r.starts_at,r.ends_at rows between unbounded preceding and 1 preceding) as previous_end from raw r),
 groups as (select r.*,sum(case when r.previous_end is null or r.starts_at>r.previous_end then 1 else 0 end) over(partition by r.user_id order by r.starts_at,r.ends_at) as group_id from prior r)
 select g.user_id,min(g.starts_at),max(g.ends_at) from groups g group by g.user_id,g.group_id order by g.user_id,min(g.starts_at);
end; $$;
revoke all on function public.get_own_busy_occurrences(timestamptz,timestamptz),public.get_project_busy_periods(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_own_busy_occurrences(timestamptz,timestamptz),public.get_project_busy_periods(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
