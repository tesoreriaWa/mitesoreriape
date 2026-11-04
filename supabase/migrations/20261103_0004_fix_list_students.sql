-- Evita errores de RPC: la consulta devuelve un directorio vacío cuando el usuario no tiene permisos.
create or replace function public.list_students_for_payment(p_group_id uuid)
returns table (user_id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select member.user_id,
         coalesce(profile.full_name, profile.display_name, 'Sin nombre') as full_name,
         profile.avatar_url
  from public.group_members as member
  join public.profiles as profile on profile.id = member.user_id
  where member.group_id = p_group_id
    and member.status = 'active'
    and (
      public.is_superadmin()
      or exists (
        select 1
        from public.group_members as requester
        where requester.group_id = p_group_id
          and requester.user_id = auth.uid()
          and requester.status = 'active'
          and requester.role in ('treasurer', 'delegate')
      )
    )
  order by coalesce(profile.full_name, profile.display_name);
$$;

revoke all on function public.list_students_for_payment(uuid) from public;
grant execute on function public.list_students_for_payment(uuid) to authenticated;
