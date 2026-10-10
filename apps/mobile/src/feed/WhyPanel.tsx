import type { RankedItem, RankingWeights } from '@repo/shared';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { contributionBars } from './contributions';
import { feedSpacing as space, type FeedPalette } from '../theme/feed';
import type { FeedbackType } from '../services/feedFeedback';

interface WhyPanelProps {
  item: RankedItem | null;
  weights: RankingWeights;
  personalization: boolean;
  palette: FeedPalette;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onFeedback: (type: FeedbackType) => void;
}

export function WhyPanel({
  item,
  weights,
  personalization,
  palette,
  busy,
  error,
  onClose,
  onFeedback,
}: WhyPanelProps) {
  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Cerrar explicación"
        />
        {item ? (
          <WhyPanelContent
            item={item}
            weights={weights}
            personalization={personalization}
            palette={palette}
            busy={busy}
            error={error}
            onClose={onClose}
            onFeedback={onFeedback}
          />
        ) : null}
      </View>
    </Modal>
  );
}

/** Exported separately so the actual sheet content can be rendered in a component test. */
export function WhyPanelContent({
  item,
  weights,
  personalization,
  palette,
  busy,
  error,
  onClose,
  onFeedback,
}: Omit<WhyPanelProps, 'item'> & { item: RankedItem }) {
  const bars = contributionBars(item, weights, personalization);
  return (
    <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: palette.ink }]}>¿Por qué veo esto?</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar explicación"
          disabled={busy}
        >
          <Text style={[styles.close, { color: palette.accent }]}>Cerrar</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: palette.ink }]}>{item.news.title}</Text>
        {item.guaranteedBy === 'esencial' ? (
          <Text
            style={[
              styles.policy,
              { color: palette.essentialInk, backgroundColor: palette.essential },
            ]}
          >
            Información esencial: tus preferencias no la quitan de «Lo que debes saber».
          </Text>
        ) : null}
        <Text style={[styles.section, { color: palette.ink }]}>Razones</Text>
        {item.reasons.map((reason) => (
          <View key={reason.code} style={styles.reason}>
            <View style={[styles.bullet, { backgroundColor: palette.accent }]} />
            <Text style={[styles.reasonText, { color: palette.secondary }]}>{reason.text}</Text>
          </View>
        ))}
        <Text style={[styles.section, { color: palette.ink }]}>Aporte al puntaje</Text>
        {bars.map((bar) => (
          <View key={bar.key} style={styles.barGroup}>
            <View style={styles.barLabels}>
              <Text style={[styles.barLabel, { color: palette.secondary }]}>{bar.label}</Text>
              <Text style={[styles.barValue, { color: palette.ink }]}>
                {Math.round(bar.value * 100)} pts
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: palette.chip }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: palette.accent,
                    width: `${Math.max(0, Math.min(100, bar.value * 100))}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
        <Text style={[styles.note, { color: palette.subtle }]}>
          Cada barra aporta puntos al orden de esta noticia. La ubicación es simulada y la
          importancia la decide el equipo editorial.
        </Text>
        {error ? (
          <Text
            style={[
              styles.error,
              { color: palette.warning, backgroundColor: palette.warningSurface },
            ]}
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => onFeedback('more_like_this')}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.action, { backgroundColor: palette.accent, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionPrimary, { color: palette.accentInk }]}>
              {busy ? 'Guardando…' : 'Más como esto'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onFeedback('less_like_this')}
            disabled={busy}
            accessibilityRole="button"
            style={[
              styles.action,
              { borderColor: palette.line, borderWidth: 1, opacity: busy ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.actionSecondary, { color: palette.ink }]}>Menos de esto</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  header: {
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontSize: 21, fontWeight: '900' },
  close: { fontSize: 14, fontWeight: '700' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: space.xl, paddingBottom: space.xl },
  title: { fontSize: 16, lineHeight: 21, fontWeight: '800', marginTop: space.lg },
  policy: { padding: space.sm, borderRadius: 6, fontSize: 12, lineHeight: 17, marginTop: space.md },
  section: { fontSize: 14, fontWeight: '800', marginTop: space.xl, marginBottom: space.sm },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  reasonText: { flex: 1, fontSize: 13, lineHeight: 18 },
  barGroup: { marginBottom: space.md },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  barLabel: { fontSize: 12 },
  barValue: { fontSize: 12, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: space.xs },
  fill: { height: 8, borderRadius: 4 },
  note: { fontSize: 11, lineHeight: 16, marginTop: space.sm },
  error: { fontSize: 12, padding: space.sm, borderRadius: 6, marginTop: space.md },
  actions: { gap: space.sm, marginTop: space.xl },
  action: { borderRadius: 8, padding: space.md, alignItems: 'center' },
  actionPrimary: { fontSize: 14, fontWeight: '800' },
  actionSecondary: { fontSize: 14, fontWeight: '800' },
});
