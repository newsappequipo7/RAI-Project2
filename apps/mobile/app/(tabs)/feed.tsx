import { findLocation, rankFeed, type RankedItem } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { CompactRow, HeroCard, LargeCard, MediumRow, MustKnowBlock } from '@/src/feed/FeedCards';
import { useNewsFeed } from '@/src/feed/useNewsFeed';
import { useProfile } from '@/src/profile/ProfileProvider';
import { feedPalette, feedSpacing as space, feedType } from '@/src/theme/feed';

function dateLabel(now: Date): string {
  return new Intl.DateTimeFormat('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Guatemala',
  }).format(now);
}

export default function FeedScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { news, config, status, error, retry } = useNewsFeed();
  const scheme = useColorScheme();
  const palette = feedPalette[scheme === 'dark' ? 'dark' : 'light'];
  const [now, setNow] = useState(() => new Date());
  const [expandedMustKnow, setExpandedMustKnow] = useState(false);
  const [requestedRefresh, setRequestedRefresh] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status === 'ready' || status === 'empty' || status === 'error') setRequestedRefresh(false);
  }, [status]);

  const ranking = useMemo(() => {
    if (!profile || (status !== 'ready' && status !== 'empty')) return null;
    try {
      return {
        value: rankFeed({
          news,
          profile,
          locationId: profile.locationId,
          now,
          weights: config.rankingWeights,
        }),
        error: null,
      };
    } catch (problem) {
      return {
        value: null,
        error: problem instanceof Error ? problem.message : 'No se pudo ordenar el feed.',
      };
    }
  }, [news, profile, status, now, config.rankingWeights]);

  const location = findLocation(profile?.locationId ?? '');
  const items = ranking?.value?.feed ?? [];
  const mustKnow = ranking?.value?.mustKnow ?? [];
  const message = error ?? ranking?.error;

  function refresh() {
    setRequestedRefresh(true);
    setNow(new Date());
    retry();
  }

  function renderCard({ item }: { item: RankedItem }) {
    const props = { item, now, palette };
    switch (item.tier) {
      case 'hero':
        return <HeroCard {...props} />;
      case 'grande':
        return <LargeCard {...props} />;
      case 'mediana':
        return <MediumRow {...props} />;
      case 'compacta':
        return <CompactRow {...props} />;
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['top']}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.news.id}
        renderItem={renderCard}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={requestedRefresh && status === 'loading'}
            onRefresh={refresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.masthead, { borderBottomColor: palette.line }]}>
              <View style={[styles.brandRule, { backgroundColor: palette.accent }]} />
              <Text style={[styles.brand, { color: palette.ink }]}>NOTICIAS</Text>
              <Text style={[styles.today, { color: palette.secondary }]}>{dateLabel(now)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ubicación simulada: ${location?.city ?? 'sin ubicación'}. Cambiar ubicación`}
              onPress={() => router.push({ pathname: '/location', params: { mode: 'change' } })}
              style={[
                styles.location,
                { borderColor: palette.line, backgroundColor: palette.surface },
              ]}
            >
              <View style={styles.locationText}>
                <Text style={[styles.locationKicker, { color: palette.subtle }]}>
                  UBICACIÓN SIMULADA
                </Text>
                <Text style={[styles.locationName, { color: palette.ink }]}>
                  {location?.city ?? 'Selecciona tu ubicación'}
                </Text>
              </View>
              <Text style={[styles.change, { color: palette.accent }]}>Cambiar ›</Text>
            </Pressable>
            {message ? (
              <View
                style={[
                  styles.statePanel,
                  { backgroundColor: palette.surface, borderColor: palette.line },
                ]}
              >
                <Text style={[styles.stateTitle, { color: palette.ink }]}>
                  No pudimos cargar las noticias
                </Text>
                <Text style={[styles.stateBody, { color: palette.secondary }]}>{message}</Text>
                <Pressable
                  onPress={refresh}
                  accessibilityRole="button"
                  style={[styles.retry, { backgroundColor: palette.accent }]}
                >
                  <Text style={[styles.retryText, { color: palette.accentInk }]}>Reintentar</Text>
                </Pressable>
              </View>
            ) : status === 'loading' || !profile ? (
              <View style={styles.loading}>
                <ActivityIndicator color={palette.accent} />
                <Text style={[styles.stateBody, { color: palette.secondary }]}>
                  Cargando noticias…
                </Text>
              </View>
            ) : (
              <>
                <MustKnowBlock
                  items={mustKnow}
                  now={now}
                  palette={palette}
                  expanded={expandedMustKnow}
                  onToggle={() => setExpandedMustKnow((previous) => !previous)}
                />
                <View style={styles.feedHeading}>
                  <Text style={[styles.sectionTitle, { color: palette.ink }]}>
                    {profile.personalization ? 'Para ti' : 'Noticias de tu zona'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: palette.secondary }]}>
                    Noticias publicadas · {location?.city ?? 'Tu ubicación'}
                  </Text>
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !message && status !== 'loading' && profile ? (
            <View style={[styles.empty, { borderColor: palette.line }]}>
              <Text style={[styles.stateTitle, { color: palette.ink }]}>
                {mustKnow.length
                  ? 'No hay más noticias recientes'
                  : 'Aún no hay noticias recientes'}
              </Text>
              <Text style={[styles.stateBody, { color: palette.secondary }]}>
                Desliza hacia abajo para actualizar. Las noticias esenciales aparecen arriba cuando
                están vigentes.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: 40 },
  masthead: {
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    marginBottom: space.md,
  },
  brandRule: { height: 5, width: 42, marginBottom: space.sm, borderRadius: 3 },
  brand: { fontSize: feedType.masthead, lineHeight: 42, letterSpacing: -1.5, fontWeight: '900' },
  today: { fontSize: 12, textTransform: 'capitalize', marginTop: 1 },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderWidth: 1,
    borderRadius: 9,
    marginBottom: space.xl,
  },
  locationText: { flex: 1 },
  locationKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  locationName: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  change: { fontSize: 13, fontWeight: '800', marginLeft: space.sm },
  statePanel: { padding: space.xl, borderWidth: 1, borderRadius: 12, marginBottom: space.xl },
  stateTitle: { fontSize: 18, fontWeight: '800' },
  stateBody: { fontSize: 13, lineHeight: 19, marginTop: space.sm },
  retry: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: 6,
    marginTop: space.lg,
  },
  retryText: { fontSize: 14, fontWeight: '800' },
  loading: { alignItems: 'center', paddingVertical: space.xxl, gap: space.md },
  feedHeading: { marginBottom: space.md },
  sectionTitle: { fontSize: feedType.section, fontWeight: '900' },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },
  empty: {
    padding: space.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: space.sm,
  },
});
