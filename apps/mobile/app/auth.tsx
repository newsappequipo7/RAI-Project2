import { Link } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

// Landing route for the `…/--/auth` deep link the web bridge sends back.
// AuthGate reads the token from the URL and leaves this screen once signed in.
export default function AuthCallbackScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text>Completando inicio de sesión…</Text>
      <Link href="/login" style={styles.link}>
        <Text style={styles.linkText}>Volver al inicio de sesión</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    color: '#2e78b7',
  },
});
