-- Base multi-salón: roles de plataforma y pertenencia por salón.
-- Ejecutar en Supabase SQL Editor o con `supabase db push`.

create type public.platform_role as enum ('superadmin', 'user');
create type public.group_role as enum ('treasurer', 'delegate', 'member', 'pending');
create type public.member_status as enum ('active', 'inactive', 'pending');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  platform_role public.platform_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles(id),
  timezone text not null default 'America/Lima',
  currency text not null default 'PEN',
  weekly_due_cents integer not null default 500 check (weekly_due_cents > 0),
  first_friday date not null default date '2026-11-06',
  opening_balance_cents integer not null default 9400 check (opening_balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.group_role not null default 'pending',
  status public.member_status not null default 'pending',
  effective_start_friday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members(user_id);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'superadmin'
  );
$$;

create function public.is_active_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function public.is_superadmin() from public;
revoke all on function public.is_active_group_member(uuid) from public;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_active_group_member(uuid) to authenticated;

create policy "profiles: own record or superadmin can read"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_superadmin());

create policy "groups: active members or superadmin can read"
on public.groups for select to authenticated
using (public.is_superadmin() or public.is_active_group_member(id));

create policy "memberships: own group or superadmin can read"
on public.group_members for select to authenticated
using (user_id = auth.uid() or public.is_superadmin() or public.is_active_group_member(group_id));

-- Este bootstrap solo puede ejecutarlo la cuenta Google indicada. Es idempotente:
-- asigna superadmin de plataforma y tesorero activo de su primer salón.
create function public.bootstrap_ariel_superadmin(salon_name text default 'Tesorería del Salón')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  salon_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para inicializar el administrador';
  end if;

  if caller_email <> 'arielxdo163@gmail.com' then
    raise exception 'Esta cuenta no está autorizada para el bootstrap inicial';
  end if;

  if char_length(trim(salon_name)) not between 1 and 80 then
    raise exception 'El nombre del salón debe tener entre 1 y 80 caracteres';
  end if;

  insert into public.profiles (id, email, display_name, platform_role)
  values (auth.uid(), caller_email, coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', 'Ariel'), 'superadmin')
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    platform_role = 'superadmin',
    updated_at = now();

  select id into salon_id from public.groups where owner_id = auth.uid() order by created_at limit 1;

  if salon_id is null then
    insert into public.groups (name, owner_id)
    values (trim(salon_name), auth.uid())
    returning id into salon_id;
  end if;

  insert into public.group_members (group_id, user_id, role, status, effective_start_friday)
  values (salon_id, auth.uid(), 'treasurer', 'active', date '2026-11-06')
  on conflict (group_id, user_id) do update set
    role = 'treasurer',
    status = 'active',
    updated_at = now();

  return salon_id;
end;
$$;

revoke all on function public.bootstrap_ariel_superadmin(text) from public;
grant execute on function public.bootstrap_ariel_superadmin(text) to authenticated;
