-- Owner-approved priority choices and atomic section ordering. Apply manually after
-- Phase 2. This migration does not change any RLS policy or runtime table grants.
begin;
do $$ begin if current_user <> 'postgres' then raise exception 'Run as postgres'; end if; end; $$;
alter table public.tasks add column priority text not null default 'normal' check (priority in ('low','normal','high'));
comment on column public.tasks.priority is 'Owner-approved task priority: low, normal (default), high.';

-- Membership management continues to use the unchanged Phase 2 RPCs, without a member cap.

-- Atomic ordering avoids partial multi-request reorder on network failure.
create function public.reorder_sections(p_project_id uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.is_project_member(p_project_id) then raise exception 'Project membership required' using errcode='42501'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 perform 1 from public.sections where project_id=p_project_id for update;
 if not private.is_project_member(p_project_id) then raise exception 'Project membership required' using errcode='42501'; end if;
 if p_ids is null or exists(select 1 from unnest(p_ids) x where x is null) or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x)
   or cardinality(p_ids)<>(select count(*) from public.sections where project_id=p_project_id)
   or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.sections s where s.id=x and s.project_id=p_project_id)) then
   raise exception 'Section IDs must exactly match the current project' using errcode='22023';
 end if;
 update public.sections s set position=ordered.n-1 from unnest(p_ids) with ordinality as ordered(id,n) where s.project_id=p_project_id and s.id=ordered.id;
end; $$;
revoke all on function public.reorder_sections(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.reorder_sections(uuid,uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
