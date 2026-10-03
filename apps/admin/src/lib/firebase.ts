import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@repo/shared';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Local development only: point Firestore at `firebase emulators:start --only firestore`.
if (import.meta.env.VITE_FIRESTORE_EMULATOR === 'true' && !import.meta.env.PROD) {
	connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/** True only in `vite dev` with the Auth emulator flag: the portal then offers an email login. */
export const USE_AUTH_EMULATOR =
	import.meta.env.VITE_AUTH_EMULATOR === 'true' && !import.meta.env.PROD;

if (USE_AUTH_EMULATOR) {
	connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
