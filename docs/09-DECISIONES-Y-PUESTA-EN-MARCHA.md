# 09 — Configuración editable y pendientes sin bloquear el desarrollo

## Ya decidido

- Web responsive, React + Firebase, GitHub.
- Saldo de apertura 94.00 soles.
- Primer cobro 2026-11-06, viernes, cuota 5.00 soles.
- Pago a deudas antiguas primero.
- Si sobra dinero, elección explícita de destino.
- Tesorero y delegado administran pagos, gastos; compañero ve caja general/meta e historial propio.
- Solo tesorero edita meta y permisos.

## Pendientes que NO deben inventarse

1. Nombre del salón: valor por defecto `Tesorería del Salón`, editable.
2. Padrón y cantidad de compañeros: comenzar vacío.
3. Fecha de arqueo del saldo de S/94: elegir al activar la caja con el usuario; no asumir la fecha de inicio del cobro.
4. Meta anual en soles y descripción: comenzar **sin configurar**.
5. Fecha final exacta de los cobros, suspensiones de vacaciones y reglas de exoneraciones: configurables por tesorero.
6. Distribución de los S/94 originales entre efectivo y billeteras digitales: opcional para arqueo, sin inventar medios.
7. Registro de cuotas anteriores al primer viernes: NO existirá salvo importación histórica voluntaria y conciliada.
8. ¿Gastos superiores al saldo? Por defecto rechazar sin autorización específica.

## Alta real recomendada

- Crear usuario Firebase Auth personal del tesorero.
- Ejecutar script de bootstrap autenticado con Admin SDK para asignar primer rol de tesorero a UID específico, con log y protección de repetición.
- Activar caja inicial tras introducir fecha de arqueo (y, si se desea, composición efectivo/digital), lo que crea un solo asiento de +9400.
- Invitar al delegado; se autentica y queda `pending`, tesorero aprueba.
- Registrar padrón real y aprobar compañeros.
- Activar cobros nuevos y reportar saldo a los compañeros.

## Cómo usar este paquete en Claude

Subir ZIP o adjuntar los documentos. Pedir que ejecute `PROMPT_PARA_CLAUDE.md`. Trabajar en iteraciones, exigir archivos completos, compilación y tests. Revisar `docs/06-PRUEBAS.md` antes de desplegar con dinero real.
