-- Actualización segura de los datos y foto de la propia cuenta.
create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text default null,
  p_avatar_url text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare caller_email text := lower(coalesce(auth.jwt() ->> 'email',''));
begin
  if auth.uid() is null or caller_email='' then raise exception 'Debes iniciar sesión'; end if;
  if char_length(trim(p_full_name)) not between 3 and 100 then raise exception 'Ingresa tu nombre completo'; end if;
  if p_phone is not null and p_phone<>'' and char_length(trim(p_phone)) not between 7 and 24 then raise exception 'Ingresa un celular válido'; end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\.ibb\.co/' then raise exception 'La imagen no es válida'; end if;
  insert into public.profiles(id,email,display_name,full_name,phone,avatar_url)
  values(auth.uid(),caller_email,trim(p_full_name),trim(p_full_name),nullif(trim(coalesce(p_phone,'')),''),p_avatar_url)
  on conflict(id) do update set email=excluded.email, display_name=excluded.display_name, full_name=excluded.full_name,
    phone=excluded.phone, avatar_url=coalesce(excluded.avatar_url, public.profiles.avatar_url), updated_at=now();
end;
$$;
revoke all on function public.update_my_profile(text,text,text) from public;
grant execute on function public.update_my_profile(text,text,text) to authenticated;
