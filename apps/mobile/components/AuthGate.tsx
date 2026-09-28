import * as Linking from 'expo-linking';
import { useRouter, useSegments } from 'expo-router';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, type User } from 'firebase/auth';
import { type ReactNode, useEffect, useState } from 'react';

import { extractIdTokenFromRedirectUrl } from '@/src/services/authBridge';
import { getFirebaseAuth } from '@/src/services/firebase';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
  }, []);

  useEffect(() => {
    function handleUrl(url: string) {
      const idToken = extractIdTokenFromRedirectUrl(url);

      if (idToken) {
        void signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken));
      }
    }

    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (initializing) {
      return;
    }

    const isOnLoginScreen = segments[0] === 'login';

    if (!user && !isOnLoginScreen) {
      router.replace('/login');
    } else if (user && isOnLoginScreen) {
      router.replace('/(tabs)/chat');
    }
  }, [user, initializing, segments, router]);

  if (initializing) {
    return null;
  }

  return children;
}
