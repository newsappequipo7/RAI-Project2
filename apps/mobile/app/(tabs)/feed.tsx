import { StyleSheet } from 'react-native';
import { LOCATIONS } from '@repo/shared';

import { Text, View } from '@/components/Themed';

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Noticias</Text>
      <Text style={styles.subtitle}>{LOCATIONS.length} ubicaciones simuladas disponibles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
  },
});
