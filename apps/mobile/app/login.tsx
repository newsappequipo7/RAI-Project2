import * as Linking from 'expo-linking';
import { GoogleAuthProvider, signInAnonymously, signInWithCredential } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { AUTH_BRIDGE_URL } from '@/src/services/authBridge';
import { openHandoff, waitForHandoffToken } from '@/src/services/authHandoff';
import { getFirebaseAuth } from '@/src/services/firebase';

export default function LoginScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUnmounted = useRef(false);

  useEffect(
    () => () => {
      isUnmounted.current = true;
    },
    [],
  );

  async function handleGoogleSignIn() {
    setError(null);
    setIsSigningIn(true);

    try {
      // Opens the full system browser, not expo-web-browser's restricted
      // ASWebAuthenticationSession: Google's sign-in loops back to the account
      // picker without completing inside that restricted session (see ADR-003).
      // The token comes back two ways: the bridge drops it in a Worker handoff the
      // app polls (works even when Android won't reopen Expo Go), and an exp://
      // deep link AuthGate listens for (faster on iOS).
      const ticket = await openHandoff();
      const redirectUri = Linking.createURL('auth');
      const query = `redirect=${encodeURIComponent(redirectUri)}&handoff=${encodeURIComponent(ticket.code)}`;
      await Linking.openURL(`${AUTH_BRIDGE_URL}?${query}`);

      const idToken = await waitForHandoffToken(ticket, () => isUnmounted.current);
      if (isUnmounted.current) return;
      if (!idToken) {
        setError('No se completó el inicio de sesión con Google. Inténtalo de nuevo.');
        return;
      }
      await signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al iniciar sesión.');
    } finally {
      if (!isUnmounted.current) setIsSigningIn(false);
    }
  }

  async function handleGuestSignIn() {
    setError(null);
    setIsSigningIn(true);

    try {
      await signInAnonymously(getFirebaseAuth());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar como invitado.');
      setIsSigningIn(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Noticias con IA</Text>
      <Pressable style={styles.button} onPress={handleGoogleSignIn} disabled={isSigningIn}>
        {isSigningIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continuar con Google</Text>
        )}
      </Pressable>
      <Pressable style={styles.guestButton} onPress={handleGuestSignIn} disabled={isSigningIn}>
        <Text style={styles.guestButtonText}>Entrar como invitado</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#2e78b7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  guestButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e78b7',
  },
  guestButtonText: {
    color: '#2e78b7',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#c0392b',
    textAlign: 'center',
  },
});
