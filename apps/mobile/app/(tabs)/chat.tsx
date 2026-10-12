import { CHAT_MAX_MESSAGE, type News } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LocationBadge } from '@/components/LocationBadge';
import { LocationNotice } from '@/components/LocationNotice';
import { useColorScheme } from '@/components/useColorScheme';
import {
  AssistantMessage,
  FailureRow,
  Suggestions,
  Typing,
  UserBubble,
} from '@/src/chat/ChatViews';
import { buildSuggestions, greeting } from '@/src/chat/presentation';
import { useChat } from '@/src/chat/useChat';
import { useNewsFeed } from '@/src/feed/useNewsFeed';
import { useProfile } from '@/src/profile/ProfileProvider';
import { feedPalette, feedSpacing as space, feedType } from '@/src/theme/feed';

export default function ChatScreen() {
  const router = useRouter();
  const palette = feedPalette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { profile } = useProfile();
  const { news } = useNewsFeed();
  const locationId = profile?.locationId ?? '';
  const newsById = useMemo(
    () => new Map<string, News>(news.map((item) => [item.id, item])),
    [news],
  );
  const suggestions = useMemo(() => buildSuggestions(news, locationId), [news, locationId]);
  const { entries, status, ask, retry, reset } = useChat(profile?.locationId, newsById);
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);
  const sending = status.state === 'sending';

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [entries.length, status.state]);

  const submit = (text: string) => {
    if (!text.trim() || sending) return;
    setDraft('');
    void ask(text);
  };
  const openNews = (id: string) => router.push({ pathname: '/news/[id]', params: { id } });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LocationBadge />
      <LocationNotice />
      <View style={[styles.privacy, { borderColor: palette.line }]}>
        <Text style={[styles.privacyText, { color: palette.subtle }]}>
          Esta conversación no se guarda.
        </Text>
        {entries.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={reset} disabled={sending}>
            <Text style={[styles.link, { color: palette.accent }]}>Nueva conversación</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.greeting, { color: palette.ink }]}>{greeting(locationId)}</Text>
        <Text style={[styles.caption, { color: palette.secondary }]}>
          Solo respondo con noticias publicadas y verificadas por el equipo editorial, y te muestro
          sus fuentes.
        </Text>
        {entries.length === 0 ? (
          <Suggestions suggestions={suggestions} palette={palette} onPick={submit} />
        ) : null}

        {entries.map((entry) =>
          entry.role === 'user' ? (
            <UserBubble key={entry.id} text={entry.text} palette={palette} />
          ) : (
            <AssistantMessage
              key={entry.id}
              response={entry.response}
              question={entry.question}
              locationId={locationId}
              palette={palette}
              onOpenNews={openNews}
            />
          ),
        )}

        {sending ? <Typing palette={palette} /> : null}
        {status.state === 'failed' ? (
          <FailureRow
            failure={status.failure}
            question={status.question}
            palette={palette}
            onRetry={retry}
          />
        ) : null}
      </ScrollView>

      <View
        style={[styles.composer, { borderColor: palette.line, backgroundColor: palette.surface }]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Pregunta sobre las noticias…"
          placeholderTextColor={palette.subtle}
          maxLength={CHAT_MAX_MESSAGE}
          multiline
          editable={!sending}
          accessibilityLabel="Escribe tu pregunta"
          style={[styles.input, { color: palette.ink }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar pregunta"
          disabled={sending || !draft.trim()}
          onPress={() => submit(draft)}
          style={[
            styles.send,
            { backgroundColor: sending || !draft.trim() ? palette.chip : palette.accent },
          ]}
        >
          <Text
            style={[
              styles.sendText,
              { color: sending || !draft.trim() ? palette.subtle : palette.accentInk },
            ]}
          >
            Enviar
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  privacy: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  privacyText: { fontSize: feedType.label },
  link: { fontSize: feedType.body, fontWeight: '600' },
  messages: { padding: space.lg, gap: space.md },
  greeting: { fontSize: feedType.medium, fontWeight: '700', lineHeight: 24 },
  caption: { fontSize: feedType.body, lineHeight: 20 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, maxHeight: 120, fontSize: feedType.compact, paddingHorizontal: space.sm },
  send: { borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: space.sm },
  sendText: { fontWeight: '700' },
});
