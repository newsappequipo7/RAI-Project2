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
        signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken)).catch(() =>
          router.replace('/login'),
        );
      }
    }

    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (initializing) {
      return;
    }

    const isOnLoginScreen = segments[0] === 'login';
    const isOnAuthCallback = segments[0] === 'auth';

    if (!user && !isOnLoginScreen && !isOnAuthCallback) {
      router.replace('/login');
    } else if (user && (isOnLoginScreen || isOnAuthCallback)) {
      router.replace('/(tabs)/chat');
    }
  }, [user, initializing, segments, router]);

  if (initializing) {
    return null;
  }

  return children;
}
