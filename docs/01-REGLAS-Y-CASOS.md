# 01 — Alcance, fechas y reglas contables

## Configuración del grupo

- Moneda: PEN. Montos en céntimos, `S/ 94.00 = 9400`, `S/ 5.00 = 500`.
- Fecha de primera obligación: **viernes 2026-11-06**.
- Periodicidad: cada viernes, sin cron obligatorio (obligaciones virtuales derivadas por fecha).
- Zona horaria: `America/Lima`. Fechas de cuota con cadenas `YYYY-MM-DD` sin depender de UTC local.
- Fin del periodo: configurable. Puede suspenderse un viernes concreto por acuerdo registrado.
- Cuota mínima semanal: S/ 5. El pago ordinario mínimo aceptado también será S/ 5; las asignaciones internas pueden incluir fracciones, como S/ 3 de crédito. Las excepciones administrativas deberán documentarse.
- Miembro incorporado después del inicio: solo responde desde su `effectiveStartFriday`.
- Fecha y hora reales de cobro distintas de fecha de la cuota cubierta.

## Apertura de caja — MUY IMPORTANTE

- Saldo inicial actual confirmado: **9400 céntimos**.
- Registrar exactamente UN asiento `opening_balance`, que sume a caja y NO sume a aportes personales, ingresos nuevos del periodo ni cuotas.
- La fecha de arqueo precisa NO se ha proporcionado; el frontend sugerirá la fecha de configuración, editable y registrada. Nunca inventar fecha de arqueo.
- Si más tarde se ingresan pagos históricos asociados al efectivo incluido en esos S/ 94, importarlos mediante `historical_reconstruction` **sin impacto adicional en caja** (con conciliación de la apertura), o realizar un asiento de ajuste/reclasificación atómico de efecto neto cero. Prohibido sumar de nuevo ese ingreso.
- No descontar el saldo inicial al repartir aportes nuevos. La caja nueva = apertura + pagos nuevos + otros ingresos - gastos - devoluciones +/- ajustes documentados.

## Estados de cuotas

- `future`: viernes aún no llegado (puede tener anticipo asignado).
- `due_today`: viernes en curso sin cubrir; NO llamarlo moroso hasta sábado.
- `overdue`: sábado o posterior y saldo de esa cuota pendiente.
- `paid`: cuota cubierta totalmente.
- `partial`: cuota parcialmente cubierta; añadir sufijo 'vence hoy' o 'vencida' según fecha.
- `paused`/`exempt`: no se cobra por decisión del grupo o exoneración específica, auditada.
- No intereses ni multas salvo nuevo acuerdo futuro explícito.

## Orden de aplicación de pago

1. Capturar monto de pago real + fecha real + método + responsable.
2. Antes de registrar, determinar obligaciones vencidas/actuales sin cubrir en orden cronológico (FIFO), teniendo en cuenta créditos aplicados y pagos existentes.
3. Aplicar a esas cuotas de más antigua a más reciente, independientemente de que paguen tarde.
4. Si existe remanente, mostrar opción de cubrir uno o más viernes futuros seleccionados (hasta cubrir cada cuota, sin superarla).
5. Resto sin distribuir: el responsable pregunta al compañero si será **saldo a favor** o **aporte adicional voluntario**. Nunca dejar remanente sin etiquetar.
6. Vista previa obligatoria: `pagado`, `aplicado a cuotas`, `crédito`, `voluntario`, `total que entra en caja`, `saldos pendientes`.
7. Al confirmar: transacción del backend con clave de idempotencia, escritura inmutable de ingreso, asignaciones y auditoría; comprobación de consistencia de sumas.

## Diferencias de conceptos

- **Caja**: efectivo + medios digitales bajo custodia, incluyendo créditos/anticipos que ya ingresaron; restar gastos.
- **Ingresos nuevos**: pagos efectivamente recibidos después de abrir caja. No incluyen el saldo de apertura ni reasignaciones internas.
- **Cuotas cubiertas**: obligaciones a las que se asignó un monto, aunque el efectivo se haya recibido en otra semana.
- **Saldo a favor**: dinero recibido y disponible para cubrir cuotas futuras; no es otro ingreso cuando se aplica.
- **Aporte voluntario**: dinero adicional que incrementa caja, pero no cubre una cuota adicional ni cancela deudas mientras existan cuotas exigibles (primero FIFO).

## Ejemplos exigidos

- Pagó S/ 10 el 06/11 y pide 2 semanas: asignar S/ 5 al 06/11 y S/ 5 al 13/11; caja +S/ 10.
- Pagó S/ 15 el 02/11: puede preasignar S/ 5 al 06, 13 y 20; caja +S/ 15 desde el 02/11.
- Debe 06 y 13, paga S/ 5 el 20/11: se aplica al 06, sigue debiendo 13 y 20.
- Paga S/ 8 el 06/11, sin deudas: aplicar S/ 5 al 06, decidir explícitamente si S/ 3 queda de crédito o aporte voluntario.
- Paga S/ 10 y ya existe anticipo de S/ 5 para la semana actual: NO asignar otra vez a la misma cuota.
- El 06/11 aún en curso: cuota impaga mostrada 'pendiente hoy', no 'moroso'.

## Presupuesto anual

La meta no altera el saldo. `progress = min(100%, caja_neta / meta)` y `excedente = max(0, caja_neta - meta)`; si la caja es negativa, mostrarla tal cual y progreso 0. Proyección = caja_neta + **cuotas FUTURAS pendientes de ingreso real** estimadas - gastos futuros estimados. Si un pago adelantado ya está en caja, NO sumarlo de nuevo a la proyección.
