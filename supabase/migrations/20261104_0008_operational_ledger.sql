-- Padrón independiente de las cuentas, caja auditable y meta anual persistida.

create table public.group_participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 3 and 100),
  phone text,
  avatar_url text,
  linked_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, linked_user_id)
);
create index group_participants_group_idx on public.group_participants(group_id, status);
alter table public.group_participants enable row level security;

-- Conserva los integrantes actuales como fichas del padrón antes de usar el nuevo flujo.
insert into public.group_participants (group_id, full_name, phone, avatar_url, linked_user_id, status, created_by)
select member.group_id, coalesce(profile.full_name, profile.display_name, 'Sin nombre'), profile.phone, profile.avatar_url,
  member.user_id, case when member.status = 'inactive' then 'inactive' else 'active' end,
  member.user_id
from public.group_members member
join public.profiles profile on profile.id = member.user_id
on conflict (group_id, linked_user_id) do nothing;

alter table public.contributions add column if not exists participant_id uuid references public.group_participants(id) on delete restrict;
alter table public.contribution_allocations add column if not exists participant_id uuid references public.group_participants(id) on delete restrict;
alter table public.contributions alter column member_id drop not null;
alter table public.contribution_allocations alter column member_id drop not null;

update public.contributions contribution
set participant_id = participant.id
from public.group_participants participant
where contribution.participant_id is null
  and participant.group_id = contribution.group_id
  and participant.linked_user_id = contribution.member_id;

update public.contribution_allocations allocation
set participant_id = participant.id
from public.group_participants participant
where allocation.participant_id is null
  and participant.group_id = allocation.group_id
  and participant.linked_user_id = allocation.member_id;

create index if not exists contributions_group_participant_idx on public.contributions(group_id, participant_id, received_on desc);
create index if not exists allocations_group_participant_due_idx on public.contribution_allocations(group_id, participant_id, due_date);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  movement_type text not null check (movement_type in ('opening', 'contribution', 'expense', 'adjustment_in', 'adjustment_out')),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (char_length(trim(reason)) between 3 and 300),
  occurred_on date not null default current_date,
  contribution_id uuid unique references public.contributions(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index cash_movements_group_date_idx on public.cash_movements(group_id, occurred_on desc, created_at desc);
alter table public.cash_movements enable row level security;

-- Aportes existentes también aparecen en la caja, una sola vez.
insert into public.cash_movements (group_id, movement_type, amount_cents, reason, occurred_on, contribution_id, recorded_by)
select contribution.group_id, 'contribution', contribution.amount_cents, 'Aporte registrado', contribution.received_on,
  contribution.id, contribution.recorded_by
from public.contributions contribution
where not exists (select 1 from public.cash_movements movement where movement.contribution_id = contribution.id);

create table public.group_goals (
  group_id uuid primary key references public.groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 100),
  target_cents integer not null check (target_cents > 0),
  target_date date not null,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.group_goals enable row level security;

create or replace function public.can_manage_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active' and role in ('treasurer', 'delegate')
  );
$$;

create policy "participants: group can read" on public.group_participants for select to authenticated
using (public.is_superadmin() or public.is_active_group_member(group_id));
create policy "cash: group can read" on public.cash_movements for select to authenticated
using (public.is_superadmin() or public.is_active_group_member(group_id));
create policy "goals: group can read" on public.group_goals for select to authenticated
using (public.is_superadmin() or public.is_active_group_member(group_id));

create or replace function public.create_group_participant(
  p_group_id uuid, p_full_name text, p_phone text default null, p_avatar_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare participant_id uuid;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para crear integrantes'; end if;
  if char_length(trim(p_full_name)) not between 3 and 100 then raise exception 'Ingresa un nombre completo'; end if;
  if p_phone is not null and char_length(trim(p_phone)) not between 7 and 24 then raise exception 'Ingresa un celular válido'; end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\.ibb\.co/' then raise exception 'La imagen no es válida'; end if;
  insert into public.group_participants(group_id, full_name, phone, avatar_url, created_by)
  values(p_group_id, trim(p_full_name), nullif(trim(coalesce(p_phone,'')),''), p_avatar_url, auth.uid()) returning id into participant_id;
  return participant_id;
end;
$$;

create or replace function public.link_participant_account(p_group_id uuid, p_participant_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para vincular cuentas'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id and status = 'active') then
    raise exception 'La cuenta debe ser un integrante activo del grupo';
  end if;
  if exists (select 1 from public.group_participants where group_id = p_group_id and linked_user_id = p_user_id and id <> p_participant_id) then
    raise exception 'Esta cuenta ya está vinculada a otro participante';
  end if;
  update public.group_participants set linked_user_id = p_user_id, updated_at = now()
  where id = p_participant_id and group_id = p_group_id and status = 'active';
  if not found then raise exception 'Participante no encontrado'; end if;
end;
$$;

create or replace function public.list_group_participants(p_group_id uuid)
returns table (participant_id uuid, full_name text, phone text, avatar_url text, linked_user_id uuid, linked_email text, total_cents bigint, last_payment_on date)
language sql stable security definer set search_path = public as $$
  select participant.id, participant.full_name, participant.phone, participant.avatar_url, participant.linked_user_id,
    profile.email, coalesce(sum(contribution.amount_cents),0)::bigint, max(contribution.received_on)
  from public.group_participants participant
  left join public.profiles profile on profile.id = participant.linked_user_id
  left join public.contributions contribution on contribution.group_id = participant.group_id and contribution.participant_id = participant.id
  where participant.group_id = p_group_id and participant.status = 'active'
    and public.can_manage_group(p_group_id)
  group by participant.id, participant.full_name, participant.phone, participant.avatar_url, participant.linked_user_id, profile.email
  order by participant.full_name;
$$;

create or replace function public.list_linkable_group_accounts(p_group_id uuid)
returns table (user_id uuid, full_name text, email text, status public.member_status)
language sql stable security definer set search_path = public as $$
  select member.user_id, coalesce(profile.full_name, profile.display_name, 'Sin nombre'), profile.email, member.status
  from public.group_members member join public.profiles profile on profile.id = member.user_id
  where member.group_id = p_group_id and member.status <> 'inactive'
    and not exists (select 1 from public.group_participants participant where participant.group_id = p_group_id and participant.linked_user_id = member.user_id)
    and public.can_manage_group(p_group_id)
  order by coalesce(profile.full_name, profile.display_name);
$$;

create or replace function public.record_participant_contribution(
  p_group_id uuid, p_participant_id uuid, p_amount_cents integer, p_received_on date default current_date, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare contribution_id uuid; group_row public.groups; remaining integer := p_amount_cents;
  due_on date; paid_for_due integer; missing_for_due integer; applied integer;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para registrar aportes'; end if;
  if p_amount_cents < 1 or p_amount_cents > 100000000 then raise exception 'Monto de aporte no válido'; end if;
  if not exists (select 1 from public.group_participants where id = p_participant_id and group_id = p_group_id and status = 'active') then
    raise exception 'El participante no está activo en este grupo';
  end if;
  select * into group_row from public.groups where id = p_group_id;
  insert into public.contributions(group_id, participant_id, amount_cents, received_on, note, recorded_by)
  values(p_group_id, p_participant_id, p_amount_cents, p_received_on, nullif(trim(coalesce(p_note,'')),''), auth.uid()) returning id into contribution_id;
  insert into public.cash_movements(group_id, movement_type, amount_cents, reason, occurred_on, contribution_id, recorded_by)
  values(p_group_id, 'contribution', p_amount_cents, 'Aporte registrado', p_received_on, contribution_id, auth.uid());
  due_on := group_row.first_friday;
  while remaining > 0 loop
    select coalesce(sum(amount_cents), 0) into paid_for_due from public.contribution_allocations
      where group_id = p_group_id and participant_id = p_participant_id and due_date = due_on;
    missing_for_due := group_row.weekly_due_cents - paid_for_due;
    if missing_for_due > 0 then
      applied := least(remaining, missing_for_due);
      insert into public.contribution_allocations(contribution_id, group_id, participant_id, due_date, amount_cents)
      values(contribution_id, p_group_id, p_participant_id, due_on, applied);
      remaining := remaining - applied;
    end if;
    due_on := due_on + 7;
  end loop;
  return contribution_id;
end;
$$;

create or replace function public.list_participant_contribution_history(p_group_id uuid, p_participant_id uuid)
returns table (contribution_id uuid, received_on date, amount_cents integer, note text, due_date date, applied_cents integer)
language sql stable security definer set search_path = public as $$
  select contribution.id, contribution.received_on, contribution.amount_cents, contribution.note, allocation.due_date, allocation.amount_cents
  from public.contributions contribution join public.contribution_allocations allocation on allocation.contribution_id = contribution.id
  where contribution.group_id = p_group_id and contribution.participant_id = p_participant_id
    and (public.can_manage_group(p_group_id) or exists (select 1 from public.group_participants participant where participant.id = p_participant_id and participant.linked_user_id = auth.uid()))
  order by allocation.due_date desc, contribution.created_at desc;
$$;

create or replace function public.list_my_contribution_history(p_group_id uuid)
returns table (contribution_id uuid, received_on date, amount_cents integer, note text, due_date date, applied_cents integer)
language sql stable security definer set search_path = public as $$
  select contribution.id, contribution.received_on, contribution.amount_cents, contribution.note, allocation.due_date, allocation.amount_cents
  from public.group_participants participant
  join public.contributions contribution on contribution.group_id = participant.group_id and contribution.participant_id = participant.id
  join public.contribution_allocations allocation on allocation.contribution_id = contribution.id
  where participant.group_id = p_group_id and participant.linked_user_id = auth.uid()
  order by allocation.due_date desc, contribution.created_at desc;
$$;

create or replace function public.record_cash_movement(
  p_group_id uuid, p_movement_type text, p_amount_cents integer, p_reason text, p_occurred_on date default current_date
) returns uuid language plpgsql security definer set search_path = public as $$
declare movement_id uuid;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para modificar la caja'; end if;
  if p_movement_type not in ('expense','adjustment_in','adjustment_out') then raise exception 'Tipo de movimiento no válido'; end if;
  if p_amount_cents < 1 or p_amount_cents > 100000000 then raise exception 'Monto no válido'; end if;
  if char_length(trim(p_reason)) not between 3 and 300 then raise exception 'Describe el motivo del movimiento'; end if;
  insert into public.cash_movements(group_id, movement_type, amount_cents, reason, occurred_on, recorded_by)
  values(p_group_id, p_movement_type, p_amount_cents, trim(p_reason), p_occurred_on, auth.uid()) returning id into movement_id;
  return movement_id;
end;
$$;

create or replace function public.list_cash_movements(p_group_id uuid)
returns table (id uuid, movement_type text, amount_cents integer, reason text, occurred_on date, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, movement_type, amount_cents, reason, occurred_on, created_at from public.cash_movements
  where group_id = p_group_id and (public.is_superadmin() or public.is_active_group_member(p_group_id))
  order by occurred_on desc, created_at desc;
$$;

create or replace function public.get_group_financial_summary(p_group_id uuid)
returns table (balance_cents bigint, participant_count bigint, payment_total_cents bigint)
language sql stable security definer set search_path = public as $$
  select
    group_row.opening_balance_cents + coalesce(sum(case when movement.movement_type in ('opening','contribution','adjustment_in') then movement.amount_cents else -movement.amount_cents end),0)::bigint,
    (select count(*) from public.group_participants where group_id = p_group_id and status = 'active'),
    coalesce(sum(case when movement.movement_type = 'contribution' then movement.amount_cents else 0 end),0)::bigint
  from public.groups group_row left join public.cash_movements movement on movement.group_id = group_row.id
  where group_row.id = p_group_id and (public.is_superadmin() or public.is_active_group_member(p_group_id))
  group by group_row.opening_balance_cents;
$$;

create or replace function public.save_group_goal(p_group_id uuid, p_name text, p_target_cents integer, p_target_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para configurar la meta'; end if;
  if char_length(trim(p_name)) not between 3 and 100 or p_target_cents < 1 or p_target_date is null then raise exception 'Completa los datos válidos de la meta'; end if;
  insert into public.group_goals(group_id,name,target_cents,target_date,updated_by)
  values(p_group_id,trim(p_name),p_target_cents,p_target_date,auth.uid())
  on conflict(group_id) do update set name=excluded.name,target_cents=excluded.target_cents,target_date=excluded.target_date,updated_by=excluded.updated_by,updated_at=now();
end;
$$;

revoke all on function public.can_manage_group(uuid) from public;
revoke all on function public.create_group_participant(uuid,text,text,text) from public;
revoke all on function public.link_participant_account(uuid,uuid,uuid) from public;
revoke all on function public.list_group_participants(uuid) from public;
revoke all on function public.list_linkable_group_accounts(uuid) from public;
revoke all on function public.record_participant_contribution(uuid,uuid,integer,date,text) from public;
revoke all on function public.list_participant_contribution_history(uuid,uuid) from public;
revoke all on function public.list_my_contribution_history(uuid) from public;
revoke all on function public.record_cash_movement(uuid,text,integer,text,date) from public;
revoke all on function public.list_cash_movements(uuid) from public;
revoke all on function public.get_group_financial_summary(uuid) from public;
revoke all on function public.save_group_goal(uuid,text,integer,date) from public;
grant execute on function public.can_manage_group(uuid) to authenticated;
grant execute on function public.create_group_participant(uuid,text,text,text) to authenticated;
grant execute on function public.link_participant_account(uuid,uuid,uuid) to authenticated;
grant execute on function public.list_group_participants(uuid) to authenticated;
grant execute on function public.list_linkable_group_accounts(uuid) to authenticated;
grant execute on function public.record_participant_contribution(uuid,uuid,integer,date,text) to authenticated;
grant execute on function public.list_participant_contribution_history(uuid,uuid) to authenticated;
grant execute on function public.list_my_contribution_history(uuid) to authenticated;
grant execute on function public.record_cash_movement(uuid,text,integer,text,date) to authenticated;
grant execute on function public.list_cash_movements(uuid) to authenticated;
grant execute on function public.get_group_financial_summary(uuid) to authenticated;
grant execute on function public.save_group_goal(uuid,text,integer,date) to authenticated;
