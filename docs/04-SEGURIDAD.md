# 04 — Política de seguridad para finanzas del salón

## Identidad y aprobación

- Firebase Auth Google. Cualquier nuevo ingreso queda `pending`; no se confiere `member` por escribir una casilla en Firestore.
- Primer tesorero aprovisionado con script Admin SDK en entorno local seguro (nunca desde la SPA). Documentar recuperación de cuentas de tesorero.
- Solo tesorero aprueba nuevas cuentas, asocia UID con el padrón y asigna delegado.
- La función de registro confirma identidad en `request.auth.uid` (Callable Functions), permisos en datos protegidos, grupo y estado del usuario.

## Regla de oro

**No exponer escritura directa por SDK del navegador en `ledger`, `allocations`, `balances`, `public`, `auditLogs`, `goals` ni movimientos de caja.** El backend hace comprobaciones y escribe atómicamente.

## Privacidad

- Miembros aprobados: leer `public/summary` y `profiles/{suUid}`; en caso de lectura de ledger personal, filtrar correctamente por `memberUid` y demostrar reglas con emuladores.
- Administradores: acceso a datos detallados necesarios, pero nunca credenciales ni tokens.
- `pending` únicamente lectura de su estado de aprobación, sin monto de caja.
- No publicar datos reales en GitHub, GitHub Pages, logs ni screenshots.

## Integridad

- Montos enteros en centavos y límites razonables para transacciones.
- Clave de idempotencia generada al iniciar formulario; repetir solicitud devuelve mismo `entryId`.
- Dos administradores operando a la vez no pueden aplicar dinero dos veces al mismo viernes; releer cuotas dentro de transacción y reintentar por concurrencia.
- Reversar con nuevo asiento, nunca `delete` o `update` en ledger final.
- Huella de auditoría con fechas del servidor, nunca confiar en `createdAt` del cliente.
- Prohibido reducir balance sin tipo de gasto/ajuste y actor visible.
- Separar ambiente `dev` de `prod`. No probar con datos reales en previews de PR.
- Si se usa Blaze, configurar alertas y monitoreo; las alertas de presupuesto no son límites de gasto.

## Reglas actuales del starter

`firestore.rules` se entrega deliberadamente con **denegación de escritura contable**. Claude debe completar reglas y pruebas, no abrirlas para que funcione una demo. Si una función Admin SDK escribe documentos, esta función debe validar la autorización: Admin SDK omite Firestore Security Rules.

## Pruebas mínimas de reglas

1. Un no autenticado no puede leer nada.
2. Un `pending` no ve saldo de caja.
3. Un compañero A no puede consultar `profiles/B`.
4. Un compañero A no puede listar pagos privados, gastos, auditoría o miembros B.
5. Un delegado no puede elevar su rol o fijar metas.
6. Un compañero no puede crear movimientos contables.
7. Un tesorero no puede escribir directam. `ledger`; debe pasar por backend.
8. Una solicitud duplicada con mismo idempotency key no duplica ingreso.
9. Un usuario dado de baja pierde accesos sin conservar sesiones privilegiadas.
