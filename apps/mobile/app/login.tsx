import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { AUTH_BRIDGE_URL } from '@/src/services/authBridge';

export default function LoginScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setIsSigningIn(true);

    try {
      // Opens full system Safari, not expo-web-browser's restricted
      // ASWebAuthenticationSession: Google's sign-in loops back to the account
      // picker without completing inside that restricted session (see ADR-003).
      // AuthGate listens for the exp:// deep link Safari hands back to the app.
      const redirectUri = Linking.createURL('auth');
      const authUrl = `${AUTH_BRIDGE_URL}?redirect=${encodeURIComponent(redirectUri)}`;
      await Linking.openURL(authUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al iniciar sesión.');
    } finally {
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
