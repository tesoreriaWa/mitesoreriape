-- Política de ingreso y administración de integrantes.
alter table public.groups
  add column if not exists require_membership_approval boolean not null default false;

create or replace function public.request_group_membership(
  p_group_code text,
  p_full_name text,
  p_phone text,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
  approval_required boolean;
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or caller_email = '' then raise exception 'Debes iniciar sesión'; end if;
  if char_length(trim(p_full_name)) not between 3 and 100 then raise exception 'Ingresa tu nombre completo'; end if;
  if char_length(trim(p_phone)) not between 7 and 24 then raise exception 'Ingresa un número de celular válido'; end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\.ibb\.co/' then raise exception 'La imagen de perfil no es válida'; end if;

  select id, require_membership_approval into target_group_id, approval_required
  from public.groups where join_code = upper(trim(p_group_code));
  if target_group_id is null then raise exception 'Código de grupo no encontrado'; end if;

  insert into public.profiles (id, email, display_name, full_name, phone, avatar_url)
  values (auth.uid(), caller_email, trim(p_full_name), trim(p_full_name), trim(p_phone), p_avatar_url)
  on conflict (id) do update set email = excluded.email, display_name = excluded.display_name,
    full_name = excluded.full_name, phone = excluded.phone,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url), updated_at = now();

  insert into public.group_members (group_id, user_id, role, status)
  values (target_group_id, auth.uid(), case when approval_required then 'pending'::public.group_role else 'member'::public.group_role end,
    case when approval_required then 'pending'::public.member_status else 'active'::public.member_status end)
  on conflict (group_id, user_id) do update set
    role = case when public.group_members.status = 'pending' then excluded.role else public.group_members.role end,
    status = case when public.group_members.status = 'pending' then excluded.status else public.group_members.status end,
    updated_at = now();
end;
$$;

create or replace function public.update_group_join_policy(p_group_id uuid, p_require_approval boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() and not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid() and role = 'treasurer' and status = 'active') then
    raise exception 'No tienes permiso para cambiar la política de ingreso';
  end if;
  update public.groups set require_membership_approval = p_require_approval, updated_at = now() where id = p_group_id;
end;
$$;

create or replace function public.list_group_members_for_admin(p_group_id uuid)
returns table (user_id uuid, full_name text, email text, avatar_url text, role public.group_role, status public.member_status)
language sql stable security definer set search_path = public as $$
  select member.user_id, coalesce(profile.full_name, profile.display_name, 'Sin nombre'), profile.email, profile.avatar_url, member.role, member.status
  from public.group_members as member join public.profiles as profile on profile.id = member.user_id
  where member.group_id = p_group_id and member.status <> 'inactive'
    and (public.is_superadmin() or exists (select 1 from public.group_members as requester where requester.group_id = p_group_id and requester.user_id = auth.uid() and requester.role = 'treasurer' and requester.status = 'active'))
  order by case when member.role = 'treasurer' then 0 else 1 end, coalesce(profile.full_name, profile.display_name);
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id = auth.uid() then raise exception 'No puedes retirarte a ti mismo'; end if;
  if not public.is_superadmin() and not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid() and role = 'treasurer' and status = 'active') then
    raise exception 'No tienes permiso para retirar integrantes';
  end if;
  update public.group_members set status = 'inactive', updated_at = now() where group_id = p_group_id and user_id = p_user_id;
end;
$$;

create or replace function public.approve_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() and not exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid() and role = 'treasurer' and status = 'active') then
    raise exception 'No tienes permiso para aprobar integrantes';
  end if;
  update public.group_members set role = 'member', status = 'active', updated_at = now()
  where group_id = p_group_id and user_id = p_user_id and status = 'pending';
end;
$$;

revoke all on function public.request_group_membership(text, text, text, text) from public;
revoke all on function public.update_group_join_policy(uuid, boolean) from public;
revoke all on function public.list_group_members_for_admin(uuid) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.approve_group_member(uuid, uuid) from public;
grant execute on function public.request_group_membership(text, text, text, text) to authenticated;
grant execute on function public.update_group_join_policy(uuid, boolean) to authenticated;
grant execute on function public.list_group_members_for_admin(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.approve_group_member(uuid, uuid) to authenticated;
