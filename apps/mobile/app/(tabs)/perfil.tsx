import { TOPICS } from '@repo/shared';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { LocationBadge } from '@/components/LocationBadge';
import { useColorScheme } from '@/components/useColorScheme';
import { useProfile } from '@/src/profile/ProfileProvider';
import { getFirebaseAuth, getFirebaseDb } from '@/src/services/firebase';
import { changeInterestProfile } from '@/src/services/interestsProfile';
import { feedPalette, feedSpacing as space } from '@/src/theme/feed';

export default function PerfilScreen() {
  const { profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const scheme = useColorScheme();
  const palette = feedPalette[scheme === 'dark' ? 'dark' : 'light'];

  const change = async (
    action:
      | { type: 'reset' }
      | { type: 'unmute'; topic: string }
      | { type: 'personalization'; enabled: boolean },
  ) => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await changeInterestProfile(getFirebaseDb(), profile.uid, action);
    } catch {
      Alert.alert('No se guardó el cambio', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: palette.ink }]}>{profile?.displayName ?? 'Perfil'}</Text>
      <LocationBadge />

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>Personalizar mi feed</Text>
            <Text style={[styles.help, { color: palette.secondary }]}>
              Si lo apagas, verás el mismo orden que otras personas en tu ubicación.
            </Text>
          </View>
          <Switch
            value={profile?.personalization ?? false}
            onValueChange={(enabled) => void change({ type: 'personalization', enabled })}
            disabled={!profile || busy}
            accessibilityLabel="Personalizar mi feed"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          Esto es lo que la app cree que te interesa
        </Text>
        <Text style={[styles.help, { color: palette.secondary }]}>
          Se calcula con tus lecturas y las opciones «Más» y «Menos como esto». Puedes reiniciarlo.
        </Text>
        {TOPICS.map((topic) => {
          const value = profile?.interests[topic.key] ?? 0;
          return (
            <View key={topic.key} style={styles.topic}>
              <View style={styles.topicLabels}>
                <Text style={[styles.topicLabel, { color: palette.ink }]}>{topic.label}</Text>
                <Text style={{ color: palette.secondary }}>{value.toFixed(1)} / 10</Text>
              </View>
              <View style={[styles.track, { backgroundColor: palette.chip }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(value * 10)}%`, backgroundColor: topic.color },
                  ]}
                />
              </View>
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          disabled={!profile || busy}
          onPress={() =>
            Alert.alert(
              'Reiniciar intereses',
              'Se borrarán los temas aprendidos y los silenciados.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Reiniciar',
                  style: 'destructive',
                  onPress: () => void change({ type: 'reset' }),
                },
              ],
            )
          }
          style={[styles.button, { borderColor: palette.accent }]}
        >
          <Text style={[styles.buttonText, { color: palette.accent }]}>Reiniciar intereses</Text>
        </Pressable>
      </View>

      {profile?.mutedTopics.length ? (
        <View
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}
        >
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>Temas silenciados</Text>
          {profile.mutedTopics.map((key) => (
            <View key={key} style={styles.mutedRow}>
              <Text style={[styles.topicLabel, { color: palette.ink }]}>
                {TOPICS.find((topic) => topic.key === key)?.label ?? key}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reactivar ${key}`}
                disabled={busy}
                onPress={() => void change({ type: 'unmute', topic: key })}
              >
                <Text style={[styles.buttonText, { color: palette.accent }]}>Reactivar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => void signOut(getFirebaseAuth())}>
        <Text style={[styles.signOut, { color: palette.accent }]}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  title: { fontSize: 24, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 10, padding: space.lg, gap: space.md },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  help: { fontSize: 13, lineHeight: 19 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleText: { flex: 1, gap: space.xs },
  topic: { gap: space.xs },
  topicLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  topicLabel: { fontSize: 14, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
  button: { padding: space.md, borderWidth: 1, borderRadius: 6, alignItems: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  mutedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  signOut: { fontSize: 15, fontWeight: '700', textAlign: 'center', padding: space.md },
});
