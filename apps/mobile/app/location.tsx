import { COUNTRIES_ES, LOCATIONS, type Location } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useProfile } from '@/src/profile/ProfileProvider';

interface Section {
  title: string;
  data: Location[];
}

function groupByCountry(): Section[] {
  const sections = new Map<string, Location[]>();

  LOCATIONS.forEach((location) => {
    const country = COUNTRIES_ES.find((item) => item.iso === location.countryIso)?.name ?? location.countryIso;
    sections.set(country, [...(sections.get(country) ?? []), location]);
  });

  return [...sections].map(([title, data]) => ({ title, data }));
}

export default function LocationScreen() {
  const { profile, saveLocation } = useProfile();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const sections = useMemo(groupByCountry, []);

  async function select(locationId: string) {
    setSavingId(locationId);
    setErrorMessage('');

    try {
      await saveLocation(locationId);
      if (mode === 'change') router.back();
      else router.replace('/(tabs)/chat');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar la ubicación');
      setSavingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¿Dónde estás?</Text>
      <Text style={styles.description}>
        Ubicación simulada: no usamos tu GPS. Elige una ciudad para personalizar tus noticias.
      </Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <SectionList
        sections={sections}
        keyExtractor={(location) => location.id}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            disabled={savingId !== null}
            onPress={() => select(item.id)}>
            <Text style={styles.city}>{item.city}</Text>
            <Text>{item.id === profile?.locationId ? '✓' : savingId === item.id ? '…' : ''}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 16 },
  description: { paddingHorizontal: 16, paddingVertical: 8, opacity: 0.7 },
  error: { color: '#c0392b', paddingHorizontal: 16 },
  section: { fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, opacity: 0.7 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  city: { fontSize: 16 },
});
