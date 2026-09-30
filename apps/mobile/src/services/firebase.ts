import AsyncStorage from '@react-native-async-storage/async-storage';
// `firebase/auth`'s exports map has no `react-native` condition for this SDK version,
// so the RN-only persistence helper must come straight from the underlying package.
import { getReactNativePersistence } from '@firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@repo/shared';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let cachedAuth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }

  return cachedAuth;
}

let cachedFirestore: Firestore | undefined;

export function getFirebaseDb(): Firestore {
  if (!cachedFirestore) {
    cachedFirestore = initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true });
  }

  return cachedFirestore;
}
