-- Cualquier cuenta autenticada puede crear su propio salón y queda como tesorero.
-- No concede el rol superadmin de plataforma.

create or replace function public.create_group_as_treasurer(
  p_group_name text,
  p_full_name text,
  p_phone text,
  p_first_friday date,
  p_weekly_due_cents integer,
  p_require_membership_approval boolean default false,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  created_group_id uuid;
begin
  if auth.uid() is null or caller_email = '' then
    raise exception 'Debes iniciar sesión para crear un grupo';
  end if;
  if char_length(trim(p_group_name)) not between 3 and 80 then
    raise exception 'El nombre del grupo debe tener entre 3 y 80 caracteres';
  end if;
  if char_length(trim(p_full_name)) not between 3 and 100 then
    raise exception 'Ingresa tu nombre completo';
  end if;
  if char_length(trim(p_phone)) not between 7 and 24 then
    raise exception 'Ingresa un número de celular válido';
  end if;
  if p_first_friday is null or extract(dow from p_first_friday) <> 5 then
    raise exception 'El primer vencimiento debe ser un viernes';
  end if;
  if p_weekly_due_cents < 100 or p_weekly_due_cents > 100000000 then
    raise exception 'La cuota semanal no es válida';
  end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\.ibb\.co/' then
    raise exception 'La imagen de perfil no es válida';
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

  insert into public.groups (
    name, owner_id, weekly_due_cents, first_friday,
    opening_balance_cents, require_membership_approval
  )
  values (
    trim(p_group_name), auth.uid(), p_weekly_due_cents, p_first_friday,
    0, p_require_membership_approval
  )
  returning id into created_group_id;

  insert into public.group_members (group_id, user_id, role, status, effective_start_friday)
  values (created_group_id, auth.uid(), 'treasurer', 'active', p_first_friday);

  return created_group_id;
end;
$$;

revoke all on function public.create_group_as_treasurer(text, text, text, date, integer, boolean, text) from public;
grant execute on function public.create_group_as_treasurer(text, text, text, date, integer, boolean, text) to authenticated;
