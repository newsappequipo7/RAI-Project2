import { StyleSheet } from 'react-native';

import { LocationBadge } from '@/components/LocationBadge';
import { Text, View } from '@/components/Themed';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <LocationBadge />
      <View style={styles.body}>
        <Text style={styles.title}>Chat</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
