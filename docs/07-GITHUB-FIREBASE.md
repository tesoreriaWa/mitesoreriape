# 07 — GitHub + Firebase: guía de despliegue

## Qué publica cada plataforma

- **GitHub**: código y documentación del repositorio (privado recomendado mientras se desarrolla).
- **Firebase Hosting**: aplicación web visible para quienes tengan el enlace. Por ejemplo `https://TU-PROYECTO.web.app` (sustituir por URL real, nunca asumir disponible).
- **Firebase Authentication**: acceso con Google y aprobación.
- **Firestore**: cuentas, caja y movimientos.
- **Cloud Functions**: escrituras financieras validadas (requiere Blaze).

## Preparación local

1. Instalar Node y Git.
2. Crear proyecto Firebase y registrar una aplicación Web.
3. Habilitar Google Sign-In en Authentication, configurar dominio autorizado.
4. Crear base de datos Firestore (usar reglas restrictivas).
5. Copiar `.env.example` a `.env.local` e ingresar configuración web.
6. `npm install && npm run dev` (starter solo vista previa).

La configuración `firebaseConfig` del SDK web suele contener identificadores públicos; **no** colocar claves privadas Admin SDK, token GitHub, service-account JSON ni archivos de contraseñas en el repositorio. Aplicar reglas de Firestore restrictivas siempre.

## Repositorio GitHub

```bash
git init
git add .
git commit -m "chore: especificacion inicial tesoreria"
git branch -M main
git remote add origin https://github.com/USUARIO/REPO.git
git push -u origin main
```

Crear repositorio vacío desde GitHub primero y sustituir URL. `.gitignore` protege `.env.local`, `node_modules/` y claves, pero comprobar `git status` antes del push.

## Firebase CLI (tras implementar backend seguro)

```bash
npm install -g firebase-tools
firebase login
firebase use --add
npm run build
firebase deploy --only hosting,firestore:rules
```

Funciones Cloud si se implementan:

```bash
firebase deploy --only functions
```

⚠️ `firebase.json` del starter solo apunta a Hosting y Firestore Rules; la carpeta de funciones y su configuración deben añadirse en la implementación segura. **No desplegar reglas directas de escritura contable para hacer que el starter funcione.**

## GitHub Actions

Firebase Hosting puede configurar integración oficial con GitHub:

```bash
firebase init hosting:github
```

Revisar permisos de la cuenta de servicio creada, secretos en GitHub y no conectar PR previews al mismo proyecto de producción con dinero real. Usar proyectos separados dev/prod o repositorios separados para pruebas.

## Facturación y límites

- Spark es el plan inicial gratuito; Firebase Cloud Functions requiere Blaze (facturación activada).
- Configurar presupuesto y alertas si se usa Blaze; **alertas NO imponen límite automático**.
- Puedes diseñar y probar el frontend gratis. Para registrar dinero con escrituras server-side, usar backend seguro, considerar cuotas y costos de Firebase.

## Referencias oficiales

- https://firebase.google.com/docs/hosting/github-integration
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/hosting
