# Instrucciones del repositorio para Claude Code

Este proyecto registra aportes de dinero real de un salón peruano. Antes de editar código, leer `PROMPT_PARA_CLAUDE.md` y todos los archivos `/docs`.

## Datos fijos (no modificar sin petición explícita)

- Saldo de apertura: **9400 céntimos = S/ 94.00**.
- Cuota: **500 céntimos = S/ 5.00**.
- Primer viernes: **2026-11-06** (America/Lima).
- Rol `treasurer`: administra roles, metas, configuración y operaciones.
- Rol `delegate`: registra pagos/gastos y ve reportes, sin gestionar roles/metas.
- Rol `member`: solo ve su historial personal y el saldo de caja/meta general.
- FIFO para deudas viejas; destino del excedente siempre elegido expresamente.
- Apertura NO debe contarse como nuevo ingreso de compañeros.
- No inventar número de compañeros, meta económica, ni fecha de arqueo.

## Invariantes obligatorios

- Montos como enteros (céntimos).
- Finanzas escritas por funciones servidor verificando rol/identidad y usando transacciones, NO directamente desde navegador.
- Firestore Rules deny-by-default y pruebas de acceso por rol.
- Append-only ledger, reversas para errores e idempotencia de cobros.
- No secretos ni datos personales en GitHub.
- El frontend actual es demostración: no se pueden registrar pagos reales hasta integrar el backend seguro.
- No deshabilitar seguridad para facilitar pruebas.

## Forma de trabajar

1. Explicar brevemente qué archivos modificarás.
2. Implementar funciones completas por fase, sin pseudocódigo.
3. Mantener tests y build verificados.
4. Actualizar `README.md` si cambian pasos de configuración.
5. Documentar qué fue realmente probado y qué falta.
6. Priorizar Fase 1 de `docs/08-FASES.md`.
