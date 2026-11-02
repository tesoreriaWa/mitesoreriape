# 06 — Matriz de pruebas y aceptación

Los importes siguientes se expresan en S/ y deben probarse con centavos exactos.

| ID | Escenario | Resultado obligatorio |
|---|---|---|
| T01 | Inicializar salón con 94.00 | Caja 94.00, nuevo ingreso 0.00, ninguna cuota ficticia pagada |
| T02 | Repetir inicialización | Caja sigue 94.00, un único asiento de apertura |
| T03 | Registrar pago 5.00 el 06/11 | Caja 99.00; cuota del 06 cubierta |
| T04 | Registrar pago 10.00 y elegir 2 semanas | Caja +10 una vez, cuota del 06 y del 13 cubiertas |
| T05 | Pago 15.00 el 02/11 adelantado tres semanas | Cobro real 02/11, cuotas 06/13/20 cubiertas; ingreso solo una vez |
| T06 | Deudas 06 y 13, pago 5 el 20 | Asignar a 06, pendientes 13 y 20 |
| T07 | Pago 8 sin deudas | Cubrir 5 + exigir escoger destino de 3; caja +8 |
| T08 | Crédito 3 y nueva semana | Nueva semana muestra 3 aplicados, deuda 2; caja no varía por aplicar crédito |
| T09 | Semana previamente pagada | No sobreasignar, queda disponible para siguiente semana o crédito |
| T10 | Enviar pago dos veces mismo token | Un asiento, una suma a caja, mismo comprobante |
| T11 | Dos administradores pagando mismo alumno simultáneamente | Asignaciones coherentes, sin cuota superior a 5 |
| T12 | Gasto 20.00 | Caja disminuye 20.00, no altera cuotas de alumnos |
| T13 | Reversa de gasto 20 | Caja recupera 20 y auditoría conserva ambas entradas |
| T14 | Pago histórico incluido en apertura | Importación NO aumenta caja |
| T15 | Usuario A accede historial B | Rechazado por reglas y funciones |
| T16 | Delegado modifica meta o roles | Rechazado |
| T17 | Compañero intenta crear pago desde SDK | Rechazado |
| T18 | Viernes actual sin pago | Pendiente hoy; deudor desde sábado |
| T19 | Semana suspendida | No se genera cuota para esa fecha |
| T20 | Miembro se integra tarde | Solo debe viernes desde su alta efectiva |
| T21 | Meta sin configurar | Mostrar estado vacío, sin monto inventado |
| T22 | Meta 2000, caja 94 | Progreso 4.7%, sin inventar recaudación |
| T23 | Meta se edita | Evento en auditoría, nuevo progreso coherente |
| T24 | Reporte | Saldo coincidente con ledger y CSV con fecha, actor, montos |
| T25 | Salida / baja de usuario | No puede acceder al saldo ni historial privado tras revocación |
| T26 | Pago S/ 0 o negativo | Rechazado |
| T27 | Pago 4.00 ordinario | Rechazado por mínimo de S/ 5, salvo ajuste administrativo documentado |
| T28 | Ataque con actualización directa de caja | Rechazado por Firestore Rules |
| T29 | Dos pagos con IDs distintos | Ambos válidos; idempotencia por operación, no por cantidad |
| T30 | Gasto mayor al saldo | Rechazado salvo política contable explícita (no asumida) |

## Pruebas técnicas requeridas

- Unitarias para motor de fechas, FIFO, asignación, crédito, proyección y sumas.
- Integración con Firebase Emulator Suite para Functions + Firestore + Authentication.
- Reglas de acceso (usuarios pendientes, compañeros, delegado, tesorero).
- UI con 320px de ancho y teclado, lectores de pantalla.
- Simular desconexión y reintentos (no duplicar pago).
- Verificación de cierre y conciliación contra total de asientos.

## Puerta de producción

Ningún dinero real ni cuentas de compañeros ingresarán hasta: tests T01-T30, reglas desplegadas, bootstrap auditado, Firebase separado para producción, respaldo probado, arqueo inicial real de S/ 94 y comprobación del enlace de Hosting.
