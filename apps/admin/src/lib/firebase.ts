import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@repo/shared';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Local development only: point Firestore at `firebase emulators:start --only firestore`.
if (import.meta.env.VITE_FIRESTORE_EMULATOR === 'true' && !import.meta.env.PROD) {
	connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
