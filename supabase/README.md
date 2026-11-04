# Supabase: primer administrador

1. En el panel de Supabase, abre **SQL Editor** y ejecuta cada archivo completo, en este orden:
   `migrations/20261102_0001_platform_roles.sql`,
   `migrations/20261102_0002_group_join_and_profiles.sql`,
   `migrations/20261103_0003_group_schedule.sql`,
   `migrations/20261103_0004_fix_list_students.sql`,
   `migrations/20261103_0005_member_access_controls.sql`,
   `migrations/20261103_0006_contributions.sql` y
   `migrations/20261104_0007_create_groups.sql` y
   `migrations/20261104_0008_operational_ledger.sql` y
   `migrations/20261104_0009_participant_crud_and_manual_allocations.sql` y
   `migrations/20261104_0010_profile_settings.sql`.
2. Inicia sesión en la web con `arielxdo163@gmail.com` mediante Google.
3. La pantalla de acceso protegido mostrará el botón **Activar superadministrador**. Púlsalo una sola vez.

El procedimiento es idempotente y solo acepta el correo Google configurado. Asigna:

- `superadmin` para administrar otros salones en el futuro.
- `treasurer` y `active` dentro de su primer salón.

No colocar nunca una `service_role` en el frontend. Las tablas no conceden inserción o actualización directa desde el navegador.

## Crear grupos por cuenta

Tras iniciar sesión, una cuenta que todavía no pertenece a ningún grupo puede elegir **Crear mi grupo**. La migración `20261104_0007_create_groups.sql` crea el salón, genera su código de invitación y asigna a esa cuenta el rol `treasurer` activo solo para ese grupo. No concede el rol global `superadmin`.

## Padrón, caja y meta reales

La migración `20261104_0008_operational_ledger.sql` agrega fichas de participantes independientes de las cuentas Google, la vinculación manual de una ficha con una cuenta registrada, movimientos de caja con motivo visible para el grupo y una meta anual persistente. Debe ejecutarse después de todas las migraciones anteriores.

La migración `20261104_0009_participant_crud_and_manual_allocations.sql` añade edición y eliminación segura de fichas, edición/anulación trazable de aportes y la selección manual de cuántas semanas cubrirá un recibo. El excedente queda guardado como saldo a favor, sin cubrir semanas adicionales de manera automática.

La migración `20261104_0010_profile_settings.sql` permite que cada cuenta actualice de forma segura su nombre, celular y foto de perfil desde **Mi perfil**. La imagen se sube con la Edge Function `upload-profile-image` y el secreto de ImgBB no llega al navegador.

## Fotos de perfil con ImgBB

La app no envía la clave de ImgBB al navegador. Antes de permitir fotos, define `IMGBB_API_KEY` como secreto de Supabase y despliega `functions/upload-profile-image`. Usa en el comando el valor privado entregado para este proyecto; no lo guardes en `.env`, código ni Git.

En el detalle de la función `upload-profile-image`, desactiva **Verify JWT with legacy secret**. La función valida explícitamente el JWT del usuario en su código mediante `auth.getUser()`, por lo que mantiene acceso exclusivo para usuarios autenticados y evita incompatibilidades con las nuevas claves publicables de Supabase.
