-- Configuración real del período y cuota. Solo el tesorero activo del grupo puede modificarla.
create or replace function public.update_group_schedule(
  p_group_id uuid,
  p_first_friday date,
  p_weekly_due_cents integer
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_superadmin() and not exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and role = 'treasurer'
      and status = 'active'
  ) then
    raise exception 'No tienes permiso para cambiar la configuración del grupo';
  end if;

  if extract(dow from p_first_friday) <> 5 then
    raise exception 'El inicio del período debe ser un viernes';
  end if;

  if p_weekly_due_cents < 100 or p_weekly_due_cents > 100000 then
    raise exception 'La cuota semanal debe estar entre S/ 1.00 y S/ 1,000.00';
  end if;

  update public.groups
  set first_friday = p_first_friday,
      weekly_due_cents = p_weekly_due_cents,
      updated_at = now()
  where id = p_group_id
  returning * into updated_group;

  if updated_group.id is null then
    raise exception 'No encontramos el grupo';
  end if;

  return updated_group;
end;
$$;

revoke all on function public.update_group_schedule(uuid, date, integer) from public;
grant execute on function public.update_group_schedule(uuid, date, integer) to authenticated;
