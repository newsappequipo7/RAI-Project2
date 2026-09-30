import { COUNTRIES_ES, findLocation } from '@repo/shared';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useProfile } from '@/src/profile/ProfileProvider';

export function describeLocation(locationId: string): string {
  const location = findLocation(locationId);
  if (!location) return 'Sin ubicación';

  const country = COUNTRIES_ES.find((item) => item.iso === location.countryIso)?.name ?? location.countryIso;
  return `${location.city}, ${country}`;
}

export function LocationBadge() {
  const { profile } = useProfile();
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Ubicación simulada: {describeLocation(profile?.locationId ?? '')}</Text>
      <Pressable onPress={() => router.push({ pathname: '/location', params: { mode: 'change' } })}>
        <Text style={styles.action}>Cambiar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: { flexShrink: 1, fontSize: 14 },
  action: { color: '#2f80ed', fontWeight: '600' },
});
