-- Libro de aportes: recibos auditables y aplicación FIFO a los viernes del grupo.
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  member_id uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  received_on date not null default current_date,
  note text check (note is null or char_length(note) <= 300),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.contribution_allocations (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete restrict,
  group_id uuid not null references public.groups(id) on delete cascade,
  member_id uuid not null references public.profiles(id),
  due_date date not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index contributions_group_member_idx on public.contributions(group_id, member_id, received_on desc);
create index allocations_group_member_due_idx on public.contribution_allocations(group_id, member_id, due_date);
alter table public.contributions enable row level security;
alter table public.contribution_allocations enable row level security;

create policy "contributions: member or treasury can read" on public.contributions for select to authenticated using (
  member_id = auth.uid() or public.is_superadmin() or exists (
    select 1 from public.group_members where group_id = contributions.group_id and user_id = auth.uid() and status = 'active' and role in ('treasurer','delegate')
  )
);
create policy "allocations: member or treasury can read" on public.contribution_allocations for select to authenticated using (
  member_id = auth.uid() or public.is_superadmin() or exists (
    select 1 from public.group_members where group_id = contribution_allocations.group_id and user_id = auth.uid() and status = 'active' and role in ('treasurer','delegate')
  )
);

create or replace function public.record_contribution(
  p_group_id uuid, p_member_id uuid, p_amount_cents integer, p_received_on date default current_date, p_note text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  contribution_id uuid; group_row public.groups; remaining integer := p_amount_cents;
  due_on date; paid_for_due integer; missing_for_due integer; applied integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if p_amount_cents < 1 or p_amount_cents > 100000000 then raise exception 'Monto de aporte no válido'; end if;
  if not public.is_superadmin() and not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid() and status = 'active' and role in ('treasurer','delegate')) then
    raise exception 'No tienes permiso para registrar aportes';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_member_id and status = 'active') then
    raise exception 'El integrante no está activo en este grupo';
  end if;
  select * into group_row from public.groups where id = p_group_id;
  if group_row.id is null then raise exception 'Grupo no encontrado'; end if;
  insert into public.contributions(group_id, member_id, amount_cents, received_on, note, recorded_by)
  values(p_group_id, p_member_id, p_amount_cents, p_received_on, nullif(trim(coalesce(p_note,'')),''), auth.uid()) returning id into contribution_id;
  due_on := group_row.first_friday;
  while remaining > 0 loop
    select coalesce(sum(amount_cents), 0) into paid_for_due from public.contribution_allocations
      where group_id = p_group_id and member_id = p_member_id and due_date = due_on;
    missing_for_due := group_row.weekly_due_cents - paid_for_due;
    if missing_for_due > 0 then
      applied := least(remaining, missing_for_due);
      insert into public.contribution_allocations(contribution_id, group_id, member_id, due_date, amount_cents)
      values(contribution_id, p_group_id, p_member_id, due_on, applied);
      remaining := remaining - applied;
    end if;
    due_on := due_on + 7;
  end loop;
  return contribution_id;
end;
$$;

create or replace function public.list_members_with_contributions(p_group_id uuid)
returns table (user_id uuid, full_name text, email text, avatar_url text, role public.group_role, status public.member_status, total_cents bigint, last_payment_on date)
language sql stable security definer set search_path = public as $$
  select member.user_id, coalesce(profile.full_name, profile.display_name, 'Sin nombre'), profile.email, profile.avatar_url, member.role, member.status,
    coalesce(sum(contribution.amount_cents), 0)::bigint, max(contribution.received_on)
  from public.group_members member join public.profiles profile on profile.id = member.user_id
  left join public.contributions contribution on contribution.group_id = member.group_id and contribution.member_id = member.user_id
  where member.group_id = p_group_id and member.status <> 'inactive'
    and (public.is_superadmin() or exists (select 1 from public.group_members requester where requester.group_id = p_group_id and requester.user_id = auth.uid() and requester.status = 'active' and requester.role in ('treasurer','delegate')))
  group by member.user_id, profile.full_name, profile.display_name, profile.email, profile.avatar_url, member.role, member.status
  order by case when member.role = 'treasurer' then 0 else 1 end, coalesce(profile.full_name, profile.display_name);
$$;

create or replace function public.list_member_contribution_history(p_group_id uuid, p_member_id uuid)
returns table (contribution_id uuid, received_on date, amount_cents integer, note text, due_date date, applied_cents integer)
language sql stable security definer set search_path = public as $$
  select contribution.id, contribution.received_on, contribution.amount_cents, contribution.note, allocation.due_date, allocation.amount_cents
  from public.contributions contribution join public.contribution_allocations allocation on allocation.contribution_id = contribution.id
  where contribution.group_id = p_group_id and contribution.member_id = p_member_id
    and (p_member_id = auth.uid() or public.is_superadmin() or exists (select 1 from public.group_members requester where requester.group_id = p_group_id and requester.user_id = auth.uid() and requester.status = 'active' and requester.role in ('treasurer','delegate')))
  order by allocation.due_date desc, contribution.created_at desc;
$$;

revoke all on function public.record_contribution(uuid,uuid,integer,date,text) from public;
revoke all on function public.list_members_with_contributions(uuid) from public;
revoke all on function public.list_member_contribution_history(uuid,uuid) from public;
grant execute on function public.record_contribution(uuid,uuid,integer,date,text) to authenticated;
grant execute on function public.list_members_with_contributions(uuid) to authenticated;
grant execute on function public.list_member_contribution_history(uuid,uuid) to authenticated;
