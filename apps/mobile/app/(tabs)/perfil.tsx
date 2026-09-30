import { signOut } from 'firebase/auth';
import { Button, StyleSheet } from 'react-native';

import { LocationBadge } from '@/components/LocationBadge';
import { Text, View } from '@/components/Themed';
import { useProfile } from '@/src/profile/ProfileProvider';
import { getFirebaseAuth } from '@/src/services/firebase';

export default function PerfilScreen() {
  const { profile } = useProfile();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile?.displayName ?? 'Perfil'}</Text>
      <LocationBadge />
      <View style={styles.footer}>
        <Button title="Cerrar sesión" onPress={() => signOut(getFirebaseAuth())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16 },
  footer: { padding: 16 },
});
