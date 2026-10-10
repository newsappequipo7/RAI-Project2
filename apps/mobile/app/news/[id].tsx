import type { News } from '@repo/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { NewsDetailContent } from '@/src/news/NewsDetailContent';
import { getFirebaseDb } from '@/src/services/firebase';
import { watchNewsDetail } from '@/src/services/newsDetail';
import { feedPalette, feedSpacing as space } from '@/src/theme/feed';

type DetailState =
  | { status: 'loading'; news: null; error: null }
  | { status: 'missing'; news: null; error: null }
  | { status: 'error'; news: null; error: string }
  | { status: 'ready'; news: News; error: null };

export default function NewsDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const [state, setState] = useState<DetailState>({ status: 'loading', news: null, error: null });
  const [versions, setVersions] = useState<News[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const scheme = useColorScheme();
  const palette = feedPalette[scheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    setState({ status: 'loading', news: null, error: null });
    setVersions([]);
    setVersionsError(null);
    if (!id || id.includes('/')) {
      setState({ status: 'missing', news: null, error: null });
      return;
    }
    try {
      return watchNewsDetail(getFirebaseDb(), id, {
        news: (news) =>
          setState(
            news
              ? { status: 'ready', news, error: null }
              : { status: 'missing', news: null, error: null },
          ),
        versions: setVersions,
        error: (error) => setState({ status: 'error', news: null, error: error.message }),
        versionsError: (error) => setVersionsError(error.message),
      });
    } catch (problem) {
      setState({
        status: 'error',
        news: null,
        error: problem instanceof Error ? problem.message : 'No se pudo cargar la noticia.',
      });
    }
  }, [id, attempt]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
      edges={['bottom']}
    >
      {state.status === 'ready' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.column}>
            <NewsDetailContent
              news={state.news}
              versions={versions}
              versionsError={versionsError}
              palette={palette}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.state}>
          {state.status === 'loading' ? (
            <>
              <ActivityIndicator color={palette.accent} />
              <Text style={[styles.stateText, { color: palette.secondary }]}>
                Cargando noticia…
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.stateTitle, { color: palette.ink }]}>
                {state.status === 'missing'
                  ? 'Noticia no disponible'
                  : 'No pudimos abrir la noticia'}
              </Text>
              <Text style={[styles.stateText, { color: palette.secondary }]}>
                {state.status === 'missing'
                  ? 'El enlace no corresponde a una noticia publicada.'
                  : state.error}
              </Text>
              {state.status === 'error' ? (
                <Pressable
                  onPress={() => setAttempt((value) => value + 1)}
                  accessibilityRole="button"
                  style={[styles.retry, { backgroundColor: palette.accent }]}
                >
                  <Text style={[styles.retryText, { color: palette.accentInk }]}>Reintentar</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: space.lg },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  stateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stateText: { fontSize: 14, lineHeight: 20, marginTop: space.sm, textAlign: 'center' },
  retry: {
    marginTop: space.lg,
    borderRadius: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  retryText: { fontSize: 14, fontWeight: '800' },
});
