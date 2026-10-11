import type { ChatBlock, ChatResponse } from '@repo/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { feedSpacing as space, feedType, type FeedPalette } from '../theme/feed';
import {
  blockCertaintyLabel,
  failureMessages,
  generationTrace,
  provenanceFooter,
  type ChatFailure,
} from './presentation';

type OpenNews = (newsId: string) => void;

export function UserBubble({ text, palette }: { text: string; palette: FeedPalette }) {
  return (
    <View style={[styles.userBubble, { backgroundColor: palette.essential }]}>
      <Text style={[styles.body, { color: palette.essentialInk }]}>{text}</Text>
    </View>
  );
}

function CertaintyChip({
  block,
  response,
  palette,
}: {
  block: ChatBlock;
  response: ChatResponse;
  palette: FeedPalette;
}) {
  const confirmed = block.certainty === 'confirmada';
  return (
    <View
      style={[styles.chip, { backgroundColor: confirmed ? palette.chip : palette.warningSurface }]}
    >
      <Text style={[styles.chipText, { color: confirmed ? palette.ink : palette.warning }]}>
        {blockCertaintyLabel(block, response)}
      </Text>
    </View>
  );
}

function SourceChips({
  block,
  response,
  palette,
  onOpenNews,
}: {
  block: ChatBlock;
  response: ChatResponse;
  palette: FeedPalette;
  onOpenNews: OpenNews;
}) {
  const sources = response.sources.filter(({ newsId }) => block.newsIds.includes(newsId));
  return (
    <View style={styles.chips}>
      {sources.map((source) => (
        <Pressable
          key={source.newsId}
          accessibilityRole="link"
          accessibilityLabel={`Abrir noticia: ${source.title}`}
          onPress={() => onOpenNews(source.newsId)}
          style={[styles.sourceChip, { borderColor: palette.line }]}
        >
          <Text style={[styles.chipText, { color: palette.accent }]} numberOfLines={1}>
            {source.title}
          </Text>
          {source.outlets.length > 0 ? (
            <Text style={[styles.outlets, { color: palette.subtle }]} numberOfLines={1}>
              {source.outlets.join(' · ')}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export function GenerationPanel({
  response,
  question,
  locationId,
  palette,
}: {
  response: ChatResponse;
  question: string;
  locationId: string;
  palette: FeedPalette;
}) {
  const trace = generationTrace(response, question, locationId);
  const rows: [string, string][] = [
    ['Intención detectada', trace.intent],
    ['Origen', trace.origin],
    ['Costo aproximado', trace.cost],
  ];
  return (
    <View style={[styles.panel, { backgroundColor: palette.chip }]}>
      {rows.map(([label, value]) => (
        <Text key={label} style={[styles.small, { color: palette.ink }]}>
          <Text style={styles.strong}>{label}: </Text>
          {value}
        </Text>
      ))}
      <Text style={[styles.small, styles.strong, { color: palette.ink }]}>
        Noticias usadas ({trace.news.length})
      </Text>
      {trace.news.length > 0 ? (
        trace.news.map((title) => (
          <Text key={title} style={[styles.small, { color: palette.secondary }]}>
            • {title}
          </Text>
        ))
      ) : (
        <Text style={[styles.small, { color: palette.secondary }]}>Ninguna</Text>
      )}
    </View>
  );
}

export function AssistantMessage({
  response,
  question,
  locationId,
  palette,
  onOpenNews,
  initiallyExpanded = false,
}: {
  response: ChatResponse;
  question: string;
  locationId: string;
  palette: FeedPalette;
  onOpenNews: OpenNews;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const noticeIsWarning = response.mode !== 'answer' && response.mode !== 'digest';

  return (
    <View
      style={[styles.assistant, { backgroundColor: palette.surface, borderColor: palette.line }]}
    >
      {response.notice ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.notice,
            { backgroundColor: noticeIsWarning ? palette.chip : palette.warningSurface },
          ]}
        >
          <Text style={[styles.small, { color: noticeIsWarning ? palette.ink : palette.warning }]}>
            {response.notice}
          </Text>
        </View>
      ) : null}

      {response.blocks.map((block, index) => (
        <View key={`${index}-${block.newsIds.join(',')}`} style={styles.block}>
          <Text style={[styles.body, { color: palette.ink }]}>{block.text}</Text>
          <View style={styles.chips}>
            <CertaintyChip block={block} response={response} palette={palette} />
          </View>
          <SourceChips
            block={block}
            response={response}
            palette={palette}
            onOpenNews={onOpenNews}
          />
        </View>
      ))}

      <Text style={[styles.footer, { color: palette.subtle }]}>{provenanceFooter(response)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
      >
        <Text style={[styles.link, { color: palette.accent }]}>
          {expanded ? 'Ocultar detalles' : '¿Cómo se generó?'}
        </Text>
      </Pressable>
      {expanded ? (
        <GenerationPanel
          response={response}
          question={question}
          locationId={locationId}
          palette={palette}
        />
      ) : null}
    </View>
  );
}

export function Suggestions({
  suggestions,
  palette,
  onPick,
}: {
  suggestions: string[];
  palette: FeedPalette;
  onPick: (text: string) => void;
}) {
  return (
    <View style={styles.suggestions}>
      {suggestions.map((text) => (
        <Pressable
          key={text}
          accessibilityRole="button"
          onPress={() => onPick(text)}
          style={[
            styles.suggestion,
            { backgroundColor: palette.surface, borderColor: palette.line },
          ]}
        >
          <Text style={[styles.body, { color: palette.ink }]}>{text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Typing({ palette }: { palette: FeedPalette }) {
  return (
    <View style={styles.typing} accessibilityLiveRegion="polite">
      <ActivityIndicator color={palette.subtle} />
      <Text style={[styles.small, { color: palette.subtle }]}>
        Buscando en las noticias publicadas…
      </Text>
    </View>
  );
}

export function FailureRow({
  failure,
  question,
  palette,
  onRetry,
}: {
  failure: ChatFailure;
  question: string;
  palette: FeedPalette;
  onRetry: () => void;
}) {
  const canRetry = failure === 'network' || failure === 'server';
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: palette.warningSurface }]}
    >
      <Text style={[styles.small, { color: palette.warning }]}>«{question}»</Text>
      <Text style={[styles.small, { color: palette.warning }]}>{failureMessages[failure]}</Text>
      {canRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={[styles.link, { color: palette.accent }]}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  assistant: {
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.sm,
  },
  block: { gap: space.xs },
  body: { fontSize: feedType.compact, lineHeight: 22 },
  small: { fontSize: feedType.body, lineHeight: 20 },
  strong: { fontWeight: '700' },
  footer: { fontSize: feedType.label, lineHeight: 16 },
  link: { fontSize: feedType.body, fontWeight: '600', paddingVertical: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  chipText: { fontSize: feedType.label, fontWeight: '600' },
  sourceChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    maxWidth: '100%',
  },
  outlets: { fontSize: feedType.label },
  notice: { borderRadius: 10, padding: space.sm, gap: space.xs },
  panel: { borderRadius: 10, padding: space.sm, gap: 2 },
  suggestions: { gap: space.sm },
  suggestion: { borderRadius: 12, borderWidth: 1, padding: space.md },
  typing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
