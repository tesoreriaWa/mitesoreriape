# 08 — Plan de desarrollo por fases para Claude

## Fase 0: Validar scaffold
- `npm install`, `npm run build`, `npm run test`.
- No conectar usuarios reales hasta terminar seguridad.

## Fase 1: Seguridad y bootstrap
- Firebase Auth (Google) con roles pending/treasurer/delegate/member.
- Bootstrap seguro del primer tesorero (Admin SDK/CLI, sin web pública).
- Modelo de documentos, Firestore Rules, pruebas de permisos (Emulator Suite).
- Asiento de apertura idempotente exactamente S/94, con fecha de arqueo registrada.

## Fase 2: Ledger y motor semanal
- Cloud Functions para `recordPayment`, `recordExpense`, `reverseEntry`, `applyCredit`, `closeWeek`.
- Transacciones con idempotencia, centavos enteros, cuotas FIFO, adelantos y créditos.
- Pruebas T01-T14, T26-T30.

## Fase 3: Frontend real
- Sustituir demo por Auth y lecturas autorizadas.
- Formularios de pagos con preview, padrón, perfiles, calendario, caja.
- Pruebas de privacidad, accesibilidad, responsive.

## Fase 4: Reportes y metas
- Meta anual editable (solo tesorero) y cálculo objetivo/proyección sin doble conteo.
- Reporte semanal/mensual, CSV/PDF, conciliación y auditoría.

## Fase 5: Publicar y operar
- Desplegar reglas / funciones / Hosting.
- Aprobar dos administradores, luego cuentas de compañeros.
- Realizar arqueo físico, registrar apertura 94 una vez y realizar prueba controlada con pagos de prueba SOLO en entorno dev.
- Respaldo, operación y mantenimiento.

## Definition of Done

Una fase se termina solo si: compila, tests pasan, hay evidencia de escenarios relevantes, la app no revela datos privados y README documenta instrucciones de operación.
