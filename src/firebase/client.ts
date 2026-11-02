import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// Starter: acceso definido, pero aún NO conecta ni escribe movimientos reales.
export function createFirebaseClients() {
  if (!config.apiKey || !config.projectId) throw new Error('Completa .env.local');
  const app = getApps()[0] ?? initializeApp(config);
  return { auth: getAuth(app), db: getFirestore(app) };
}
