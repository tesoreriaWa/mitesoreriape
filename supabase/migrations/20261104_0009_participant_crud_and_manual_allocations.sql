-- CRUD seguro del padrón y aportes con semanas decididas por tesorería.

alter table public.contributions
  add column if not exists weeks_to_cover integer,
  add column if not exists credit_cents integer not null default 0 check (credit_cents >= 0),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id),
  add column if not exists void_reason text;

create or replace function public.update_group_participant(
  p_group_id uuid, p_participant_id uuid, p_full_name text, p_phone text default null, p_avatar_url text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para editar integrantes'; end if;
  if char_length(trim(p_full_name)) not between 3 and 100 then raise exception 'Ingresa un nombre completo'; end if;
  if p_phone is not null and p_phone <> '' and char_length(trim(p_phone)) not between 7 and 24 then raise exception 'Ingresa un celular válido'; end if;
  update public.group_participants set full_name=trim(p_full_name), phone=nullif(trim(coalesce(p_phone,'')),''),
    avatar_url=coalesce(p_avatar_url, avatar_url), updated_at=now()
  where id=p_participant_id and group_id=p_group_id and status='active';
  if not found then raise exception 'Participante no encontrado'; end if;
end;
$$;

create or replace function public.delete_group_participant(p_group_id uuid, p_participant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para eliminar integrantes'; end if;
  if exists (select 1 from public.contributions where group_id=p_group_id and participant_id=p_participant_id and voided_at is null) then
    update public.group_participants set status='inactive', updated_at=now() where id=p_participant_id and group_id=p_group_id;
    return 'archived';
  end if;
  delete from public.group_participants where id=p_participant_id and group_id=p_group_id;
  if not found then raise exception 'Participante no encontrado'; end if;
  return 'deleted';
end;
$$;

-- Reconstruye las semanas cubiertas de una ficha respetando el número elegido en cada recibo.
create or replace function public.rebuild_participant_allocations(p_group_id uuid, p_participant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare group_row public.groups; receipt record; remaining integer; due_on date;
  paid_for_due integer; missing_for_due integer; applied integer; covered_weeks integer;
begin
  select * into group_row from public.groups where id=p_group_id;
  if group_row.id is null then raise exception 'Grupo no encontrado'; end if;
  delete from public.contribution_allocations where group_id=p_group_id and participant_id=p_participant_id;
  for receipt in select id, amount_cents, weeks_to_cover from public.contributions
    where group_id=p_group_id and participant_id=p_participant_id and voided_at is null
    order by received_on, created_at
  loop
    remaining := receipt.amount_cents; covered_weeks := 0; due_on := group_row.first_friday;
    while remaining > 0 and (receipt.weeks_to_cover is null or covered_weeks < receipt.weeks_to_cover) loop
      select coalesce(sum(amount_cents),0) into paid_for_due from public.contribution_allocations
      where group_id=p_group_id and participant_id=p_participant_id and due_date=due_on;
      missing_for_due := group_row.weekly_due_cents - paid_for_due;
      if missing_for_due > 0 then
        applied := least(remaining, missing_for_due);
        insert into public.contribution_allocations(contribution_id, group_id, participant_id, due_date, amount_cents)
        values(receipt.id,p_group_id,p_participant_id,due_on,applied);
        remaining := remaining - applied;
        covered_weeks := covered_weeks + 1;
      end if;
      due_on := due_on + 7;
    end loop;
    update public.contributions set credit_cents=remaining where id=receipt.id;
  end loop;
end;
$$;

create or replace function public.record_participant_contribution(
  p_group_id uuid, p_participant_id uuid, p_amount_cents integer, p_received_on date default current_date,
  p_note text default null, p_weeks_to_cover integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare contribution_id uuid;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para registrar aportes'; end if;
  if p_amount_cents < 1 or p_amount_cents > 100000000 then raise exception 'Monto de aporte no válido'; end if;
  if p_weeks_to_cover is not null and (p_weeks_to_cover < 1 or p_weeks_to_cover > 104) then raise exception 'Selecciona entre 1 y 104 semanas'; end if;
  if not exists (select 1 from public.group_participants where id=p_participant_id and group_id=p_group_id and status='active') then raise exception 'El participante no está activo'; end if;
  insert into public.contributions(group_id,participant_id,amount_cents,received_on,note,recorded_by,weeks_to_cover)
  values(p_group_id,p_participant_id,p_amount_cents,p_received_on,nullif(trim(coalesce(p_note,'')),''),auth.uid(),p_weeks_to_cover)
  returning id into contribution_id;
  insert into public.cash_movements(group_id,movement_type,amount_cents,reason,occurred_on,contribution_id,recorded_by)
  values(p_group_id,'contribution',p_amount_cents,'Aporte registrado',p_received_on,contribution_id,auth.uid());
  perform public.rebuild_participant_allocations(p_group_id,p_participant_id);
  return contribution_id;
end;
$$;

create or replace function public.update_participant_contribution(
  p_group_id uuid, p_contribution_id uuid, p_amount_cents integer, p_received_on date,
  p_note text default null, p_weeks_to_cover integer default null
) returns void language plpgsql security definer set search_path = public as $$
declare participant uuid;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para editar aportes'; end if;
  if p_amount_cents < 1 or p_amount_cents > 100000000 then raise exception 'Monto de aporte no válido'; end if;
  if p_weeks_to_cover is not null and (p_weeks_to_cover < 1 or p_weeks_to_cover > 104) then raise exception 'Selecciona entre 1 y 104 semanas'; end if;
  update public.contributions set amount_cents=p_amount_cents, received_on=p_received_on,
    note=nullif(trim(coalesce(p_note,'')),''), weeks_to_cover=p_weeks_to_cover
  where id=p_contribution_id and group_id=p_group_id and voided_at is null returning participant_id into participant;
  if participant is null then raise exception 'Aporte no encontrado o anulado'; end if;
  update public.cash_movements set amount_cents=p_amount_cents, occurred_on=p_received_on,
    reason='Aporte actualizado' where contribution_id=p_contribution_id and group_id=p_group_id;
  perform public.rebuild_participant_allocations(p_group_id,participant);
end;
$$;

create or replace function public.void_participant_contribution(p_group_id uuid, p_contribution_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare participant uuid;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'No tienes permiso para anular aportes'; end if;
  if char_length(trim(p_reason)) not between 3 and 300 then raise exception 'Indica el motivo de la anulación'; end if;
  update public.contributions set voided_at=now(), voided_by=auth.uid(), void_reason=trim(p_reason)
  where id=p_contribution_id and group_id=p_group_id and voided_at is null returning participant_id into participant;
  if participant is null then raise exception 'Aporte no encontrado o ya anulado'; end if;
  update public.cash_movements set movement_type='adjustment_out', reason='Aporte anulado: ' || trim(p_reason)
  where contribution_id=p_contribution_id and group_id=p_group_id;
  perform public.rebuild_participant_allocations(p_group_id,participant);
end;
$$;

create or replace function public.list_participant_receipts(p_group_id uuid, p_participant_id uuid)
returns table (id uuid, received_on date, amount_cents integer, note text, weeks_to_cover integer, credit_cents integer)
language sql stable security definer set search_path=public as $$
  select id, received_on, amount_cents, note, weeks_to_cover, credit_cents
  from public.contributions
  where group_id=p_group_id and participant_id=p_participant_id and voided_at is null
    and (public.can_manage_group(p_group_id) or exists (select 1 from public.group_participants where id=p_participant_id and linked_user_id=auth.uid()))
  order by received_on desc, created_at desc;
$$;

revoke all on function public.update_group_participant(uuid,uuid,text,text,text) from public;
revoke all on function public.delete_group_participant(uuid,uuid) from public;
revoke all on function public.rebuild_participant_allocations(uuid,uuid) from public;
revoke all on function public.record_participant_contribution(uuid,uuid,integer,date,text,integer) from public;
revoke all on function public.update_participant_contribution(uuid,uuid,integer,date,text,integer) from public;
revoke all on function public.void_participant_contribution(uuid,uuid,text) from public;
revoke all on function public.list_participant_receipts(uuid,uuid) from public;
grant execute on function public.update_group_participant(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.delete_group_participant(uuid,uuid) to authenticated;
grant execute on function public.rebuild_participant_allocations(uuid,uuid) to authenticated;
grant execute on function public.record_participant_contribution(uuid,uuid,integer,date,text,integer) to authenticated;
grant execute on function public.update_participant_contribution(uuid,uuid,integer,date,text,integer) to authenticated;
grant execute on function public.void_participant_contribution(uuid,uuid,text) to authenticated;
grant execute on function public.list_participant_receipts(uuid,uuid) to authenticated;
