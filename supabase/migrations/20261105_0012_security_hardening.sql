-- Endurecimiento de producción: límites, idempotencia y permisos mínimos.
-- Esta migración no expone datos nuevos; protege las mutaciones ya existentes.

create table if not exists public.mutation_rate_limits (
  -- Puede haber una subida de foto antes de que la cuenta cree su perfil público.
  actor_id uuid not null,
  action text not null check (action in ('create_group', 'create_participant', 'contribution', 'cash_movement', 'profile_image')),
  window_started_at timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (actor_id, action, window_started_at)
);
alter table public.mutation_rate_limits enable row level security;

-- Solo las funciones SECURITY DEFINER pueden tocar este contador.
create or replace function public.assert_mutation_rate(p_action text, p_max_hits integer, p_window_seconds integer default 60)
returns void language plpgsql security definer set search_path = public as $$
declare
  bucket timestamptz;
  new_hits integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if p_max_hits < 1 or p_window_seconds not between 10 and 3600 then raise exception 'Configuración de límite no válida'; end if;
  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.mutation_rate_limits(actor_id, action, window_started_at, hits)
  values (auth.uid(), p_action, bucket, 1)
  on conflict (actor_id, action, window_started_at)
  do update set hits = public.mutation_rate_limits.hits + 1
  returning hits into new_hits;
  if new_hits > p_max_hits then
    raise exception 'Demasiadas acciones seguidas. Espera un momento e inténtalo nuevamente.';
  end if;
end;
$$;

-- Solo tesorero y superadministrador pueden alterar dinero, padrón o identidad del grupo.
create or replace function public.can_operate_treasury(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active' and role = 'treasurer'
  );
$$;

-- Las claves de solicitud hacen que un reintento de red no cree dos movimientos.
alter table public.contributions add column if not exists request_key uuid;
alter table public.cash_movements add column if not exists request_key uuid;
create unique index if not exists contributions_idempotency_key_idx
  on public.contributions(group_id, recorded_by, request_key) where request_key is not null;
create unique index if not exists cash_movements_idempotency_key_idx
  on public.cash_movements(group_id, recorded_by, request_key) where request_key is not null;

create or replace function public.rebuild_participant_allocations(p_group_id uuid, p_participant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare group_row public.groups; receipt record; remaining integer; due_on date;
  paid_for_due integer; missing_for_due integer; applied integer; covered_weeks integer;
begin
  -- Evita que dos clics simultáneos reescriban las semanas de la misma ficha a la vez.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_group_id::text || ':' || p_participant_id::text, 0));
  select * into group_row from public.groups where id=p_group_id;
  if group_row.id is null then raise exception 'Grupo no encontrado'; end if;
  delete from public.contribution_allocations where group_id=p_group_id and participant_id=p_participant_id;
  for receipt in select id, amount_cents, weeks_to_cover from public.contributions
    where group_id=p_group_id and participant_id=p_participant_id and voided_at is null
    order by received_on, created_at
  loop
    remaining := receipt.amount_cents; covered_weeks := 0; due_on := group_row.first_friday;
    while remaining > 0 and covered_weeks < least(coalesce(receipt.weeks_to_cover, 104), 104) loop
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

-- Función interna: no debe poder llamarla un integrante desde la API.
revoke all on function public.rebuild_participant_allocations(uuid,uuid) from public, anon, authenticated;

-- Retira versiones antiguas que podían repartir un importe sin límite de semanas.
drop function if exists public.record_participant_contribution(uuid,uuid,integer,date,text);
drop function if exists public.record_participant_contribution(uuid,uuid,integer,date,text,integer);
drop function if exists public.record_cash_movement(uuid,text,integer,text,date);

create or replace function public.record_participant_contribution(
  p_group_id uuid, p_participant_id uuid, p_amount_cents integer, p_received_on date,
  p_note text, p_weeks_to_cover integer, p_request_key uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare contribution_id uuid;
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para registrar aportes'; end if;
  if p_amount_cents not between 1 and 100000000 then raise exception 'Monto de aporte no válido'; end if;
  if p_weeks_to_cover not between 1 and 104 then raise exception 'Selecciona entre 1 y 104 semanas'; end if;
  if p_received_on is null or p_received_on < current_date - 3650 or p_received_on > current_date + 366 then raise exception 'Fecha de aporte no válida'; end if;
  if char_length(trim(coalesce(p_note, ''))) > 300 then raise exception 'La nota no puede superar 300 caracteres'; end if;
  if p_request_key is null then raise exception 'Solicitud de aporte inválida'; end if;
  select id into contribution_id from public.contributions
  where group_id=p_group_id and recorded_by=auth.uid() and request_key=p_request_key;
  if contribution_id is not null then return contribution_id; end if;
  perform public.assert_mutation_rate('contribution', 12, 60);
  if not exists (select 1 from public.group_participants where id=p_participant_id and group_id=p_group_id and status='active') then
    raise exception 'El participante no está activo';
  end if;
  insert into public.contributions(group_id,participant_id,amount_cents,received_on,note,recorded_by,weeks_to_cover,request_key)
  values(p_group_id,p_participant_id,p_amount_cents,p_received_on,nullif(trim(coalesce(p_note,'')),''),auth.uid(),p_weeks_to_cover,p_request_key)
  returning id into contribution_id;
  insert into public.cash_movements(group_id,movement_type,amount_cents,reason,occurred_on,contribution_id,recorded_by)
  values(p_group_id,'contribution',p_amount_cents,'Aporte registrado',p_received_on,contribution_id,auth.uid());
  perform public.rebuild_participant_allocations(p_group_id,p_participant_id);
  return contribution_id;
end;
$$;

create or replace function public.update_participant_contribution(
  p_group_id uuid, p_contribution_id uuid, p_amount_cents integer, p_received_on date,
  p_note text, p_weeks_to_cover integer
) returns void language plpgsql security definer set search_path = public as $$
declare participant uuid;
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para editar aportes'; end if;
  perform public.assert_mutation_rate('contribution', 12, 60);
  if p_amount_cents not between 1 and 100000000 then raise exception 'Monto de aporte no válido'; end if;
  if p_weeks_to_cover not between 1 and 104 then raise exception 'Selecciona entre 1 y 104 semanas'; end if;
  if p_received_on is null or p_received_on < current_date - 3650 or p_received_on > current_date + 366 then raise exception 'Fecha de aporte no válida'; end if;
  if char_length(trim(coalesce(p_note, ''))) > 300 then raise exception 'La nota no puede superar 300 caracteres'; end if;
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
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para anular aportes'; end if;
  perform public.assert_mutation_rate('contribution', 12, 60);
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 300 then raise exception 'Indica el motivo de la anulación'; end if;
  update public.contributions set voided_at=now(), voided_by=auth.uid(), void_reason=trim(p_reason)
  where id=p_contribution_id and group_id=p_group_id and voided_at is null returning participant_id into participant;
  if participant is null then raise exception 'Aporte no encontrado o ya anulado'; end if;
  update public.cash_movements set movement_type='adjustment_out', reason='Aporte anulado: ' || trim(p_reason)
  where contribution_id=p_contribution_id and group_id=p_group_id;
  perform public.rebuild_participant_allocations(p_group_id,participant);
end;
$$;

create or replace function public.record_cash_movement(
  p_group_id uuid, p_movement_type text, p_amount_cents integer, p_reason text,
  p_occurred_on date, p_request_key uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare movement_id uuid;
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para modificar la caja'; end if;
  if p_movement_type not in ('expense','adjustment_in','adjustment_out') then raise exception 'Tipo de movimiento no válido'; end if;
  if p_amount_cents not between 1 and 100000000 then raise exception 'Monto no válido'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 300 then raise exception 'Describe el motivo del movimiento'; end if;
  if p_occurred_on is null or p_occurred_on < current_date - 3650 or p_occurred_on > current_date + 366 then raise exception 'Fecha del movimiento no válida'; end if;
  if p_request_key is null then raise exception 'Solicitud de movimiento inválida'; end if;
  select id into movement_id from public.cash_movements
  where group_id=p_group_id and recorded_by=auth.uid() and request_key=p_request_key;
  if movement_id is not null then return movement_id; end if;
  perform public.assert_mutation_rate('cash_movement', 10, 60);
  insert into public.cash_movements(group_id,movement_type,amount_cents,reason,occurred_on,recorded_by,request_key)
  values(p_group_id,p_movement_type,p_amount_cents,trim(p_reason),p_occurred_on,auth.uid(),p_request_key)
  returning id into movement_id;
  return movement_id;
end;
$$;

-- El padrón contiene teléfono y cuentas: solo tesorería puede gestionarlo o listar esos datos.
create or replace function public.create_group_participant(p_group_id uuid, p_full_name text, p_phone text default null, p_avatar_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare participant_id uuid;
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para crear integrantes'; end if;
  perform public.assert_mutation_rate('create_participant', 30, 60);
  if char_length(trim(coalesce(p_full_name,''))) not between 3 and 100 then raise exception 'Ingresa un nombre completo'; end if;
  if p_phone is not null and char_length(trim(p_phone)) not between 7 and 24 then raise exception 'Ingresa un celular válido'; end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\\.ibb\\.co/' then raise exception 'La imagen no es válida'; end if;
  insert into public.group_participants(group_id, full_name, phone, avatar_url, created_by)
  values(p_group_id, trim(p_full_name), nullif(trim(coalesce(p_phone,'')),''), p_avatar_url, auth.uid()) returning id into participant_id;
  return participant_id;
end;
$$;

create or replace function public.update_group_participant(p_group_id uuid, p_participant_id uuid, p_full_name text, p_phone text default null, p_avatar_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para editar integrantes'; end if;
  perform public.assert_mutation_rate('create_participant', 30, 60);
  if char_length(trim(coalesce(p_full_name,''))) not between 3 and 100 then raise exception 'Ingresa un nombre completo'; end if;
  if p_phone is not null and p_phone <> '' and char_length(trim(p_phone)) not between 7 and 24 then raise exception 'Ingresa un celular válido'; end if;
  update public.group_participants set full_name=trim(p_full_name), phone=nullif(trim(coalesce(p_phone,'')),''), avatar_url=coalesce(p_avatar_url, avatar_url), updated_at=now()
  where id=p_participant_id and group_id=p_group_id and status='active';
  if not found then raise exception 'Participante no encontrado'; end if;
end;
$$;

create or replace function public.delete_group_participant(p_group_id uuid, p_participant_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para eliminar integrantes'; end if;
  perform public.assert_mutation_rate('create_participant', 30, 60);
  if exists (select 1 from public.contributions where group_id=p_group_id and participant_id=p_participant_id and voided_at is null) then
    update public.group_participants set status='inactive', updated_at=now() where id=p_participant_id and group_id=p_group_id;
    return 'archived';
  end if;
  delete from public.group_participants where id=p_participant_id and group_id=p_group_id;
  if not found then raise exception 'Participante no encontrado'; end if;
  return 'deleted';
end;
$$;

create or replace function public.link_participant_account(p_group_id uuid, p_participant_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para vincular cuentas'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id and status = 'active') then raise exception 'La cuenta debe ser un integrante activo del grupo'; end if;
  if exists (select 1 from public.group_participants where group_id = p_group_id and linked_user_id = p_user_id and id <> p_participant_id) then raise exception 'Esta cuenta ya está vinculada a otro participante'; end if;
  update public.group_participants set linked_user_id = p_user_id, updated_at = now() where id = p_participant_id and group_id = p_group_id and status = 'active';
  if not found then raise exception 'Participante no encontrado'; end if;
end;
$$;

create or replace function public.save_group_goal(p_group_id uuid, p_name text, p_target_cents integer, p_target_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para configurar la meta'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 3 and 100 or p_target_cents not between 1 and 1000000000 or p_target_date is null then raise exception 'Completa los datos válidos de la meta'; end if;
  if p_target_date < current_date or p_target_date > current_date + 3650 then raise exception 'La fecha objetivo no es válida'; end if;
  insert into public.group_goals(group_id,name,target_cents,target_date,updated_by)
  values(p_group_id,trim(p_name),p_target_cents,p_target_date,auth.uid())
  on conflict(group_id) do update set name=excluded.name,target_cents=excluded.target_cents,target_date=excluded.target_date,updated_by=excluded.updated_by,updated_at=now();
end;
$$;

create or replace function public.update_group_branding(p_group_id uuid, p_institution_logo_url text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_operate_treasury(p_group_id) then raise exception 'No tienes permiso para personalizar este grupo'; end if;
  if p_institution_logo_url is null or p_institution_logo_url !~ '^https://i\\.ibb\\.co/' then raise exception 'El logo no es válido'; end if;
  update public.groups set institution_logo_url=p_institution_logo_url, updated_at=now() where id=p_group_id;
end;
$$;

-- La función Edge reclama un cupo antes de enviar una imagen a ImgBB.
create or replace function public.claim_profile_image_upload_slot()
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_mutation_rate('profile_image', 5, 600);
end;
$$;

-- Una cuenta puede crear pocos grupos por hora; así se evita llenar la BD.
create or replace function public.create_group_as_treasurer(
  p_group_name text, p_full_name text, p_phone text, p_first_friday date,
  p_weekly_due_cents integer, p_require_membership_approval boolean default false,
  p_avatar_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  created_group_id uuid;
begin
  if auth.uid() is null or caller_email = '' then raise exception 'Debes iniciar sesión para crear un grupo'; end if;
  if char_length(trim(coalesce(p_group_name,''))) not between 3 and 80 then raise exception 'El nombre del grupo debe tener entre 3 y 80 caracteres'; end if;
  if char_length(trim(coalesce(p_full_name,''))) not between 3 and 100 then raise exception 'Ingresa tu nombre completo'; end if;
  if char_length(trim(coalesce(p_phone,''))) not between 7 and 24 then raise exception 'Ingresa un número de celular válido'; end if;
  if p_first_friday is null or extract(dow from p_first_friday) <> 5 or p_first_friday < current_date - 365 or p_first_friday > current_date + 3650 then raise exception 'El primer vencimiento debe ser un viernes válido'; end if;
  if p_weekly_due_cents not between 100 and 100000000 then raise exception 'La cuota semanal no es válida'; end if;
  if p_avatar_url is not null and p_avatar_url !~ '^https://i\\.ibb\\.co/' then raise exception 'La imagen de perfil no es válida'; end if;
  insert into public.profiles (id, email, display_name, full_name, phone, avatar_url)
  values (auth.uid(), caller_email, trim(p_full_name), trim(p_full_name), trim(p_phone), p_avatar_url)
  on conflict (id) do update set email=excluded.email, display_name=excluded.display_name, full_name=excluded.full_name,
    phone=excluded.phone, avatar_url=coalesce(excluded.avatar_url, public.profiles.avatar_url), updated_at=now();
  perform public.assert_mutation_rate('create_group', 3, 3600);
  insert into public.groups (name, owner_id, weekly_due_cents, first_friday, opening_balance_cents, require_membership_approval)
  values (trim(p_group_name), auth.uid(), p_weekly_due_cents, p_first_friday, 0, p_require_membership_approval)
  returning id into created_group_id;
  insert into public.group_members (group_id, user_id, role, status, effective_start_friday)
  values (created_group_id, auth.uid(), 'treasurer', 'active', p_first_friday);
  return created_group_id;
end;
$$;

-- Permisos explícitos: anon nunca ejecuta funciones de negocio.
revoke all on function public.assert_mutation_rate(text,integer,integer) from public, anon, authenticated;
revoke all on function public.can_operate_treasury(uuid) from public, anon;
revoke all on function public.claim_profile_image_upload_slot() from public, anon;
grant execute on function public.can_operate_treasury(uuid) to authenticated;
grant execute on function public.claim_profile_image_upload_slot() to authenticated;
grant execute on function public.record_participant_contribution(uuid,uuid,integer,date,text,integer,uuid) to authenticated;
grant execute on function public.update_participant_contribution(uuid,uuid,integer,date,text,integer) to authenticated;
grant execute on function public.void_participant_contribution(uuid,uuid,text) to authenticated;
grant execute on function public.record_cash_movement(uuid,text,integer,text,date,uuid) to authenticated;
grant execute on function public.create_group_participant(uuid,text,text,text) to authenticated;
grant execute on function public.update_group_participant(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.delete_group_participant(uuid,uuid) to authenticated;
grant execute on function public.link_participant_account(uuid,uuid,uuid) to authenticated;
grant execute on function public.save_group_goal(uuid,text,integer,date) to authenticated;
grant execute on function public.update_group_branding(uuid,text) to authenticated;
grant execute on function public.create_group_as_treasurer(text,text,text,date,integer,boolean,text) to authenticated;
