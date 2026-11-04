-- Identidad visual por grupo: logo de la institución o salón.
alter table public.groups add column if not exists institution_logo_url text;

create or replace function public.update_group_branding(p_group_id uuid, p_institution_logo_url text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para personalizar este grupo'; end if;
  if p_institution_logo_url is null or p_institution_logo_url !~ '^https://i\.ibb\.co/' then raise exception 'El logo no es válido'; end if;
  update public.groups set institution_logo_url=p_institution_logo_url, updated_at=now() where id=p_group_id;
end;
$$;
revoke all on function public.update_group_branding(uuid,text) from public;
grant execute on function public.update_group_branding(uuid,text) to authenticated;
