# 03 — Esquema Firestore propuesto

> Claude puede refinar nombres, pero debe mantener los invariantes. Todas las mutaciones financieras se ejecutan mediante backend confiable en transacciones; no se usa el navegador como autoridad de caja.

```
groups/{groupId}
  settings/main
  members/{uid}
  weeks/{weekId}                # opcional: excepciones; deuda ordinaria se deriva sin cron
  ledger/{entryId}              # append-only, cada entrada monetaria real / reversa
  allocations/{allocationId}    # vínculo monto recibido -> cuota o saldo a favor
  balances/main                 # proyección materializada validada por backend
  public/summary                # documento sanitizado legible para miembros
  profiles/{uid}                # resumen privado calculado + historial
  goals/{goalId}
  auditLogs/{logId}
  idempotency/{keyHash}
```

## `members/{uid}`

`uid`, `displayName`, `email`, `role` (`pending|treasurer|delegate|member`), `active`, `joinedAt`, `effectiveStartFriday`, `leftAt?`, `createdBy`, `createdAt`, `updatedAt`. No datos secretos.

## `settings/main`

`name`, `timezone:'America/Lima'`, `currency:'PEN'`, `weeklyDueCents:500`, `firstFriday:'2026-11-06'`, `lastFriday:null|YYYY-MM-DD`, `openingBalanceCents:9400`, `openingEntryId`, `openingRecordedAt`, `pausedFridays:[]`, `ownerUid`, `createdAt`.

> **Regla**: openingBalanceCents es dato inmutable de configuración inicial y el ledger tiene UNA sola entrada `opening_balance`; al calcular caja desde ledger no sumar de nuevo el campo de settings.

## `ledger/{entryId}`

Campos inmutables: `groupId`, `kind` (`opening_balance|payment|expense|refund|reversal|adjustment|historical_reconstruction`), `deltaCents` (positivo para ingresos, negativo para egresos), `cashEffect` (`+|-|0` semántico), `memberUid?`, `receivedAt?`, `effectiveAt`, `method?`, `reference?`, `note?`, `actorUid`, `idempotencyKeyHash`, `reversalOf?`, `createdAt`, `metadata`.

- `opening_balance`: `deltaCents: 9400`, solo una vez, no es aporte individual.
- `payment`: `deltaCents > 0`, ingreso nuevo en caja.
- `expense`/`refund`: `deltaCents < 0`.
- `reversal`: contrapartida igual y opuesta del original, sin editar/borrar original.
- `historical_reconstruction`: `deltaCents:0` para mapear historia incluida en apertura, sin sumar dinero otra vez.
- El valor de caja se calcula a partir de sum(deltaCents) de ledger válido; balance materializado se actualiza en la misma transacción.

## `allocations/{allocationId}`

`paymentEntryId`, `memberUid`, `kind` (`week|credit|donation|credit_application|allocation_reversal`), `weekId?` (`YYYY-MM-DD`), `amountCents` entero positivo, `createdAt`, `actorUid`. Las asignaciones no modifican saldo de caja. Su suma por pago debe coincidir con el importe recibido, exceptuando reconstrucciones, aplicaciones de crédito y reversas, cuyo vínculo se documenta por separado.

## `balances/main`

`cashCents`, `openingCents`, `newPaymentsCents`, `expensesCents`, `refundsCents`, `adjustmentsCents`, `version`, `updatedAt`. Usar actualizaciones ATÓMICAS y reconciliar contra el ledger.

## `public/summary`

`cashCents`, `goalName?`, `goalCents?`, `goalDeadline?`, `goalProgressPercent?`, `updatedAt`. **Nada** de correos, lista de pagos, nombres, deudas por persona o métodos de pago.

## `profiles/{uid}`

`memberUid`, `myPaidCents`, `myCoveredWeekCents`, `myCreditCents`, `myDueCents`, `myOverdueCents`, `nextDue`, `updatedAt`. El historial puede leerse de `ledger` filtrado por `memberUid` o colección personal calculada; la consulta debe cumplir reglas y filtros.

## `goals/{goalId}`

`name`, `targetCents`, `deadline`, `active`, `createdBy`, `createdAt`, `updatedAt`. Cambios auditados, sin borrar historia.

## `auditLogs/{logId}`

`actorUid`, `action`, `entityType`, `entityId`, `beforeHash?`, `afterHash?`, `reason?`, `createdAt`, `requestId`. Escribe exclusivamente backend.

## Índices orientativos

- ledger: `memberUid ASC, createdAt DESC`
- ledger: `kind ASC, createdAt DESC`
- allocations: `memberUid ASC, weekId ASC`
- auditLogs: `createdAt DESC`

Índices exactos se completan en desarrollo en `firestore.indexes.json`.
