# 02 — Roles, permisos e interfaz

## Roles

| Acción | Tesorero | Delegado | Compañero |
|---|---|---|---|
| Ver caja neta general | Sí | Sí | Sí |
| Ver meta y progreso general | Sí | Sí | Sí |
| Ver su historial personal | Sí | Sí | Sí |
| Ver listado de integrantes y deudas individuales | Sí | Sí | No |
| Registrar cobros, gastos, devoluciones | Sí | Sí | No |
| Ver desglose detallado, comprobantes, reportes | Sí | Sí | No |
| Editar meta, cuota, fechas, pausar semanas | Sí | No | No |
| Aprobar usuario, vincular cuenta, roles, altas/bajas | Sí | No | No |
| Ajustar/revertir asiento inicial | Tesorero con auditoría y conciliación | No | No |
| Ver auditoría completa | Sí | Consulta | No |

`pending` no puede ver el saldo del salón hasta ser aprobado.

## Menú administrador

1. **Inicio**: caja actual, meta, recaudación, deudas, adelantos, resumen de gastos y actividad reciente.
2. **Compañeros**: búsqueda, miembro activo/inactivo, estado, fecha ingreso, historial y ficha personal.
3. **Registrar pago**: persona, monto, cobro real, método, FIFO, anticipo, crédito/voluntario, resumen antes de confirmar.
4. **Control semanal**: calendario por viernes, atrasos, próximos, exonerados, suspensión, exportación.
5. **Caja**: movimientos de ingreso, egreso, apertura, ajustes y conciliación.
6. **Gastos**: conceptos, importe, comprobante opcional (almacenamiento requiere considerar plan), método, actor y reversa.
7. **Reportes**: por fecha y persona, CSV/PDF, balance y arqueo.
8. **Configuración**: solo tesorero edita meta, fecha fin, cuota, perfiles, usuarios y roles.

## Menú compañero

1. **Inicio**: saldo neto del salón y meta general, % de avance, estado personal, próxima cuota.
2. **Mis aportes**: fechas reales, monto recibido, método si procede, cuotas cubiertas, saldo a favor, recibos propios.
3. **Mi calendario**: futuro/pagado/parcial/pendiente/vencido solo de esa persona.
4. **Mi perfil**: nombre y correo vinculado; solicitar corrección al tesorero.

## Accesibilidad y UX

- Mobile first: barra inferior en móvil y lateral/superior en PC.
- Botones grandes y etiquetas legibles; colores acompañados de texto para no depender solo del color.
- Confirmación antes de registrar movimientos, reversas y gastos.
- Bloquear doble envío y mostrar ID de operación y recibo.
- Separar "fecha del movimiento" de "viernes cubierto".
- Mostrar moneda `S/ 94.00` y fechas `dd/mm/yyyy`.
- Permitir filtros por mes y viernes y exportar resúmenes.
- Mostrar expresamente "No hay meta configurada" hasta que el tesorero la defina; no inventar S/ 2,000 ni objetivo anual.

## Pantalla inicial esperada

- Saldo neto en caja: **S/ 94.00**.
- Meta: **Sin configurar**.
- Próximo vencimiento: **viernes 06/11/2026** (respecto de la fecha de configuración inicial).
- Recibos nuevos: **S/ 0.00** hasta que se registren.
- Miembros: **0** hasta su carga real.
- El starter del repositorio es *demostración*, no credenciales reales ni movimientos persistentes.
