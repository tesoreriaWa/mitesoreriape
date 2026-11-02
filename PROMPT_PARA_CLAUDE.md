# PROMPT MAESTRO — ENTREGAR A CLAUDE

Eres un desarrollador senior fullstack especializado en React, TypeScript, Firebase, Firestore Rules, Cloud Functions, pruebas y accesibilidad. Tu tarea es transformar ESTE repositorio en una **app web de tesorería real, segura, auditable, responsive y desplegable**, manteniendo exactamente las reglas de los documentos `/docs`.

## Contexto

Soy el tesorero de un salón de estudiantes en Perú. Hoy contamos con **S/ 94.00 en caja**, que DEBEN aparecer como **asiento inicial de apertura**, no como aporte nuevo de los compañeros. La cuota es **S/ 5 cada viernes**, empezando el **2026-11-06**, usando la zona horaria **America/Lima**. Yo (tesorero) y el delegado podemos registrar pagos y gastos. Cada compañero inicia sesión y solo consulta su propio historial de pagos y una portada general con: **dinero actual en caja, progreso de la meta anual, y su estado personal**. Solo el tesorero configura metas, miembros, roles y parámetros; el delegado administra transacciones sin poder escalar permisos.

## Stack obligatorio

- React + TypeScript + Vite + CSS responsive (o Tailwind si justificas) + iconos Lucide.
- Firebase Authentication (Google; onboarding por aprobación), Cloud Firestore, Firebase Hosting.
- Backend privilegiado mediante Firebase Cloud Functions (Admin SDK, plan Blaze) PARA movimientos financieros; si no hay Blaze, explica la limitación y no habilites registro contable inseguro. La SPA NO puede modificar directamente colecciones de pagos, gastos, caja, asignaciones, auditorio ni resúmenes públicos.
- GitHub para control de versiones. Preparar despliegue Firebase Hosting y opcionalmente integración GitHub Actions con secretos de deploy. NO incluir credenciales privadas.
- Montos en enteros (céntimos), nunca coma flotante para operaciones.

## Documentos de referencia OBLIGATORIOS

1. `docs/01-REGLAS-Y-CASOS.md`
2. `docs/02-PANTALLAS-Y-ROLES.md`
3. `docs/03-MODELO-DE-DATOS.md`
4. `docs/04-SEGURIDAD.md`
5. `docs/05-MOTOR-FINANCIERO.md`
6. `docs/06-PRUEBAS.md`
7. `docs/07-GITHUB-FIREBASE.md`
8. `docs/08-FASES.md`
9. `docs/09-DECISIONES-Y-PUESTA-EN-MARCHA.md`
10. `schemas/configuracion-inicial.json`

## Lo que debes implementar

- Pantalla de acceso Google; usuarios nuevos permanecen `pending` hasta aprobación por tesorero; emparejar UID de Auth con miembro, nunca confiar en un UID enviado desde navegador sin comparar con token.
- Dashboard tesorero/delegado: caja neta, recaudación recibida, deudas vencidas, cuota esperada, pagos adelantados, meta, gastos, últimas actividades.
- Dashboard compañero: **solo saldo de caja (S/ 94 al iniciar), meta anual y progreso, estado personal, total de sus pagos e historial privado**. No lista global de deudores ni gastos detallados.
- Padrón de integrantes; altas/bajas, ingreso posterior, suspensiones y gestión roles por tesorero.
- Registro de pagos con fecha real de recepción, monto, método (efectivo/Yape/Plin/transferencia), referencia opcional, nota, actor, idempotency key, cuotas cubiertas, saldo a favor, aporte voluntario. Antes de confirmar, mostrar desglose.
- Aplicar primero a cuotas VENCIDAS sin pagar, de la más antigua a la más reciente. Luego permitir asignar a viernes FUTUROS concretos. Resto obligatorio: elegir saldo a favor o aporte voluntario; no decidir automáticamente sin consentimiento.
- Cuotas semanales derivadas sin cron: aparecen el viernes a 00:00 hora de Lima como 'pendiente', y desde sábado 'vencida'; fechas pasadas pendientes sin borrarse; se pueden pagar antes, durante o después.
- Los créditos de saldo a favor se pueden aplicar automáticamente a nuevas cuotas al ser exigibles, sin generar otro ingreso en caja. Reflejar correctamente la distinción entre crédito, anticipo asignado y abono voluntario.
- Gastos, correcciones con reversos, historial auditable, cierre de semana y reportes (CSV y PDF si es factible).
- Meta anual editable por tesorero con monto, título y fecha y cambios auditados; predicción SOLO sobre pagos futuros pendientes por cobrar para no duplicar adelantos.
- Herramienta de apertura de caja **exactamente una vez**, idempotente, con monto 9400 y procedencia no desglosada. Si se reconstruye historia, usar herramienta de conciliación que NO vuelva a sumar los S/ 94.
- Interfaz mobile-first en español peruano, `S/`, fechas locales, estados accesibles y exportación.

## Seguridad y consistencia

- No confiar en validaciones del cliente; validar de nuevo en backend identidad, roles, montos, cuotas, método, fechas, estado y distribución.
- Funciones financieras atómicas con transacciones Firestore e idempotency keys; no permitir escritura directa del cliente en ledger.
- Auditoría server-side append-only; creación de miembros y cambio de roles exclusivamente tesorero; proteger tesorero principal contra auto-degradación accidental.
- `firestore.rules` debe ser deny-by-default, solo lectura de documentos públicos sanitizados y documentos personales autorizados; prohibir escribir movimientos desde clientes.
- Prevenir que compañeros consulten datos de otros incluso por consultas, API y rutas directas. Testear reglas con Firebase Emulator Suite.
- No publicar datos reales, correo de usuarios ni secretos en código GitHub. Diferenciar explícitamente entorno de desarrollo y producción.

## Entregas esperadas

A) Primero revisa el starter y produce un plan concreto de archivos a crear/modificar + riesgos detectados, SIN volver a preguntar datos que ya constan.
B) Implementa por fases, aportando código ejecutable y NO solo fragmentos ni pseudocódigo. Mantén `npm run build` y tests en verde.
C) Incluye esquema Firestore, reglas completas, Cloud Functions, inicialización autorizada del primer tesorero y de la apertura de S/ 94, frontend y pruebas.
D) README actualizado con setup local, emuladores, variables `.env`, despliegue a Firebase Hosting, configuración Auth Google y GitHub Actions opcional.
E) Muestra cómo revisar en demo el rol compañero, delegado y tesorero; separa datos de demostración de producción.
F) No declares listo para manejar dinero hasta pasar los escenarios de `docs/06-PRUEBAS.md` y reconciliar caja con un arqueo físico.

**Primera tarea concreta:** lee los documentos y comienza la Fase 1 con la autenticación, el modelo de datos, autorización, bootstrap seguro del tesorero y apertura idempotente de S/ 94.00. Entrega archivos completos y comandos de verificación antes de pasar a la fase siguiente.
