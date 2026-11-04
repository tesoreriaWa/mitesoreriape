-- Afiliación por código, perfil de estudiante y directorio limitado a tesorería.

create function public.new_group_code()
returns text
language sql
volatile
set search_path = public
as $$ select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); $$;

alter table public.profiles
  add column full_name text,
  add column phone text,
  add column avatar_url text;

alter table public.groups
  add column join_code text not null unique default public.new_group_code(),
  add constraint groups_join_code_format check (join_code ~ '^[A-Z0-9]{8}$');

create function public.request_group_membership(
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
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or caller_email = '' then
    raise exception 'Debes iniciar sesión';
  end if;
  if char_length(trim(p_full_name)) not between 3 and 100 then
    raise exception 'Ingresa tu nombre completo';
  end if;
  if char_length(trim(p_phone)) not between 7 and 24 then
    raise exception 'Ingresa un número de celular válido';
  end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\.ibb\.co/' then
    raise exception 'La imagen de perfil no es válida';
  end if;

  select id into target_group_id
  from public.groups
  where join_code = upper(trim(p_group_code));
  if target_group_id is null then
    raise exception 'Código de grupo no encontrado';
  end if;

  insert into public.profiles (id, email, display_name, full_name, phone, avatar_url)
  values (auth.uid(), caller_email, trim(p_full_name), trim(p_full_name), trim(p_phone), p_avatar_url)
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    full_name = excluded.full_name,
    phone = excluded.phone,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  insert into public.group_members (group_id, user_id, role, status)
  values (target_group_id, auth.uid(), 'pending', 'pending')
  on conflict (group_id, user_id) do update set
    updated_at = now();
end;
$$;

create function public.list_students_for_payment(p_group_id uuid)
returns table (user_id uuid, full_name text, avatar_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() and not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
      and status = 'active' and role in ('treasurer', 'delegate')
  ) then
    raise exception 'No tienes permiso para consultar estudiantes';
  end if;

  return query
  select membership.user_id, coalesce(profile.full_name, profile.display_name, 'Sin nombre'), profile.avatar_url
  from public.group_members membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.group_id = p_group_id
    and membership.status = 'active'
  order by coalesce(profile.full_name, profile.display_name);
end;
$$;

revoke all on function public.request_group_membership(text, text, text, text) from public;
revoke all on function public.list_students_for_payment(uuid) from public;
grant execute on function public.request_group_membership(text, text, text, text) to authenticated;
grant execute on function public.list_students_for_payment(uuid) to authenticated;
