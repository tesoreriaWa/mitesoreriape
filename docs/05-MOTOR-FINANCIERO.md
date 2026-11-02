# 05 — Motor de cuotas y asignaciones

## Flujo de registro (backend, con transacción)

1. Validar Auth, grupo, rol (`treasurer` o `delegate`), miembro activo, monto entero ≥ 500 céntimos, método y fecha válida.
2. Validar `idempotencyKey`: si existe, devolver resultado original sin repetir caja.
3. Obtener horario y excepciones de cuotas. Construir semanas entre el `effectiveStartFriday` del miembro y la fecha de aplicación del pago; no inventar obligaciones en semanas pausadas/exentas.
4. Consultar asignaciones netas vigentes y créditos aplicables. Determinar deuda por cada viernes, cap 500 céntimos.
5. Aplicar importe primero a **semanas exigibles sin cubrir, más antiguas primero**. Impedir adelantos si queda deuda exigible que ese dinero podría pagar.
6. Con el resto, usar semanas futuras elegidas explícitamente, en orden cronológico. Impedir sobreasignar o asignar a semana suspendida.
7. Resto > 0 requiere decisión explícita `credit` o `donation`. Aceptar que créditos fraccionarios se apliquen a vencimientos posteriores, sin movimiento adicional de caja.
8. Verificar `sum(weeks)+credit+donation === paidAmountCents`.
9. Escribir asiento contable, asignaciones, balance materializado, perfil privado y resumen público + auditoría, de forma atómica, con timestamps del servidor.
10. Devolver identificador, resumen y comprobante imprimible.

## Reglas para créditos

Ejemplo: lunes antes de comenzar cobros un alumno deja S/ 8 y elige S/ 5 para la primera semana + S/ 3 crédito. Se reciben S/ 8 ahora (caja +800). En el segundo viernes se puede aplicar automáticamente 300 céntimos de crédito a la cuota de S/ 5; quedarán 200 céntimos por pagar. Aplicar esos 300 NO suma caja nuevamente. En pantalla debe quedar visible tanto la reserva/consumo de crédito como el estado parcial de la semana.

## Proyección

- Configurable `goalCents`, `deadline` y número de miembros activos de cada viernes.
- `expectedUncollectedFutureCents` = suma de cuota de cada viernes futuro programado, menos anticipos o créditos destinados a ese viernes y cualquier cobro registrado ya incluido en caja.
- Proyección = caja actual + expectativa de cobros futuros no recibidos - gastos esperados.
- No presentar como ingreso garantizado; distinguir escenario optimista y real.

## Control de caja

- `cashCents = sum(deltaCents)` desde ledger (apertura + movimientos reales). Ajustes y reversas explícitos.
- El saldo almacenado es caché de esa suma, NO una segunda fuente de dinero.
- Recalcular periódicamente para identificar discrepancias.
- Semana/cierre: snapshot de caja, pagos, deuda acumulada, gastos, generado por admin con fecha.
- Arqueo físico: confirmar efectivo y dinero digital y permitir ajuste documentado si hay diferencia.

## Fuente de fechas

Conservar fecha/hora real de pago como instante UTC + mostrar America/Lima. Las semanas se identifican por `YYYY-MM-DD` del **viernes de Perú**. Evitar derivar fechas en JS local sin normalizar zona. Un viernes no pagado se marca vencido a partir de las 00:00 del sábado Lima.

## ¿Qué hacer si hay deudas más antiguas que el 06/11?

Nada se presupone. El saldo inicial S/94 es anónimo. Registrar deudas previas SOLO si el tesorero define fechas y padrón histórico; importar el detalle con conciliación.
