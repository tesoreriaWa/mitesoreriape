# Tesorería del Salón — Especificación + base web para Claude

> **Estado:** starter visual ejecutable + especificación completa. NO es todavía una aplicación contable productiva ni está conectada para escribir pagos reales. La pantalla muestra el saldo inicial real de **S/ 94.00**; el resto de las funciones administrativas deben implementarse y probarse con Claude antes de usar dinero del salón.

## Qué hay aquí

- `PROMPT_PARA_CLAUDE.md`: instrucciones completas listas para copiar a Claude.
- `docs/`: alcance, roles, reglas del dinero, modelo de datos, seguridad, pantallas, pruebas y despliegue.
- `schemas/`: configuración inicial y ejemplos de documentos para Firestore.
- `src/`: frontend React + TypeScript + Vite, con pantalla de demostración de roles, meta y caja inicial.
- `src/core/treasury.ts`: funciones puras iniciales para fechas, cálculo de cuotas y reparto de abonos; revisar con tests antes de producción.
- `firestore.rules`: reglas **cerradas para escritura de movimientos**, intencionalmente seguras hasta completar el backend.
- `firebase.json`: Firebase Hosting con fallback SPA.

## Principios no negociables

1. **Caja inicial:** `9400` céntimos (S/ 94.00). Es un asiento de apertura, NO un pago nuevo ni un aporte de compañero.
2. **Cuota semanal:** `500` céntimos (S/ 5.00). Vencimiento todos los viernes, empezando `2026-11-06` (America/Lima).
3. **Roles:** `treasurer`, `delegate`, `member` (+ `pending`). Tesorero y delegado registran operaciones; compañero solo ve su historial y el saldo general de caja/metas.
4. **Deudas:** aplicar pagos primero a la semana vencida más antigua. Saldo restante: decidir explícitamente entre adelanto a semanas concretas, saldo a favor o aporte voluntario.
5. **Cuentas:** el saldo de caja, los importes recaudados por compañeros y las cuotas cubiertas son conceptos diferentes. Nunca sumar dos veces un mismo pago.
6. **Seguridad:** los datos contables deben validarse del lado del servidor (Cloud Functions + Admin SDK o backend confiable equivalente) ANTES de habilitar registros reales. No aceptar como verdadero un cálculo del navegador.
7. **Auditoría:** nunca borrar movimientos, solo reversas/anulaciones justificadas; registrar actor, hora y motivo.
8. **GitHub no es la web:** GitHub almacena el código; el enlace compartible de la app proviene de Firebase Hosting.

## Abrir el starter de interfaz

Requiere Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
```

La vista de demostración está diseñada para operar **sin datos reales** y sin conexión a Firebase. Puedes revisarla y pasar este repositorio a Claude. El objetivo del starter es facilitar el diseño y la integración, NO reemplazar el motor contable seguro.

Para compilar:

```bash
npm run build
npm run test
```

## Firebase

1. Crear proyecto Firebase y activar **Authentication (Google)**, **Cloud Firestore** y **Hosting**.
2. Copiar `.env.example` a `.env.local` y poner los identificadores públicos de la aplicación web.
3. **No** subir `.env.local`, claves JSON de service accounts, credenciales de administración ni datos privados de compañeros a GitHub.
4. Implementar backend seguro y reglas finales antes de importar los datos reales.
5. Consultar `docs/07-GITHUB-FIREBASE.md` para el despliegue.

> **Facturación:** Firebase Cloud Functions requiere plan Blaze. Si NO se habilita Blaze, conservar el producto en modo demostración o construir y auditar una alternativa de backend seguro antes de manejar dinero. El plan Blaze puede generar cargos; las alertas de presupuesto no limitan el gasto automáticamente.

## Orden de trabajo recomendado

1. Leer `PROMPT_PARA_CLAUDE.md`.
2. Encargar a Claude primera fase (auth/roles/schema/reglas backend).
3. Encargar motor contable y pruebas.
4. Integrar frontend, pruebas de privacidad, importación y despliegue.
5. Solo después de verificar cierres/conciliación, cargar datos verdaderos.

## Datos que aún no inventamos

- Nombre real y cantidad de compañeros.
- Fecha exacta de arqueo de los S/ 94.
- Meta anual (monto y nombre).
- Viernes final del periodo de aportes y semanas suspendidas, si las hay.
- Qué parte de los S/ 94 proviene de cuotas anteriores: dejar inicialmente `procedencia: no_desglosada`.

Ver decisiones configurables en `docs/09-DECISIONES-Y-PUESTA-EN-MARCHA.md`.
