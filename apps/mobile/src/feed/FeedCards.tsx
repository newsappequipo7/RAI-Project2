import { findTopic, type News, type RankedItem } from '@repo/shared';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewsImage } from './NewsImage';
import { newsLabels, relativePublishedAt } from './presentation';
import { feedSpacing as space, feedType, type FeedPalette } from '../theme/feed';

interface CardProps {
  item: RankedItem;
  now: Date;
  palette: FeedPalette;
}

function openNews(id: string, router: ReturnType<typeof useRouter>) {
  router.push({ pathname: '/news/[id]', params: { id } });
}

function TopicMark({ news, palette }: { news: News; palette: FeedPalette }) {
  const color = findTopic(news.topics[0] ?? '')?.color ?? palette.accent;
  return <View style={[styles.topicMark, { backgroundColor: color }]} />;
}

export function NewsChips({ news, palette }: { news: News; palette: FeedPalette }) {
  const labels = newsLabels(news);
  return (
    <View
      style={styles.chips}
      accessibilityLabel={[labels.topic, labels.scope, labels.certainty].filter(Boolean).join(', ')}
    >
      <View style={[styles.chip, { backgroundColor: palette.chip }]}>
        <Text style={[styles.chipText, { color: palette.ink }]}>{labels.topic}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: palette.chip }]}>
        <Text style={[styles.chipText, { color: palette.ink }]}>{labels.scope}</Text>
      </View>
      {labels.certainty ? (
        <View style={[styles.chip, { backgroundColor: palette.warningSurface }]}>
          <Text style={[styles.chipText, { color: palette.warning }]}>{labels.certainty}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TimeLabel({ news, now, palette }: { news: News; now: Date; palette: FeedPalette }) {
  return (
    <Text style={[styles.time, { color: palette.subtle }]}>
      {relativePublishedAt(news.publishedAt, now)}
    </Text>
  );
}

function ArticleLink({
  children,
  news,
  style,
}: {
  children: ReactNode;
  news: News;
  style: object;
}) {
  const router = useRouter();
  return (
    <Pressable
      style={style}
      onPress={() => openNews(news.id, router)}
      accessibilityRole="button"
      accessibilityLabel={`Leer noticia: ${news.title}`}
    >
      {children}
    </Pressable>
  );
}

export function HeroCard({ item, now, palette }: CardProps) {
  const { news } = item;
  return (
    <ArticleLink
      news={news}
      style={[styles.hero, { backgroundColor: palette.surface, borderColor: palette.line }]}
    >
      <NewsImage news={news} palette={palette} />
      <View style={styles.heroBody}>
        <TopicMark news={news} palette={palette} />
        <Text style={[styles.heroTitle, { color: palette.ink }]}>{news.title}</Text>
        <Text style={[styles.lead, { color: palette.secondary }]} numberOfLines={3}>
          {news.lead}
        </Text>
        <NewsChips news={news} palette={palette} />
        <TimeLabel news={news} now={now} palette={palette} />
      </View>
    </ArticleLink>
  );
}

export function LargeCard({ item, now, palette }: CardProps) {
  const { news } = item;
  return (
    <ArticleLink
      news={news}
      style={[styles.large, { backgroundColor: palette.surface, borderColor: palette.line }]}
    >
      <NewsImage news={news} palette={palette} />
      <View style={styles.largeBody}>
        <Text style={[styles.largeTitle, { color: palette.ink }]}>{news.title}</Text>
        <NewsChips news={news} palette={palette} />
        <TimeLabel news={news} now={now} palette={palette} />
      </View>
    </ArticleLink>
  );
}

export function MediumRow({ item, now, palette }: CardProps) {
  const { news } = item;
  return (
    <ArticleLink
      news={news}
      style={[styles.medium, { backgroundColor: palette.surface, borderColor: palette.line }]}
    >
      <NewsImage news={news} palette={palette} variant="mini" />
      <View style={styles.mediumBody}>
        <Text style={[styles.mediumTitle, { color: palette.ink }]} numberOfLines={4}>
          {news.title}
        </Text>
        <NewsChips news={news} palette={palette} />
        <TimeLabel news={news} now={now} palette={palette} />
      </View>
    </ArticleLink>
  );
}

export function CompactRow({ item, now, palette }: CardProps) {
  const { news } = item;
  return (
    <ArticleLink news={news} style={[styles.compact, { borderColor: palette.line }]}>
      <TopicMark news={news} palette={palette} />
      <Text style={[styles.compactTitle, { color: palette.ink }]}>{news.title}</Text>
      <NewsImage news={news} palette={palette} variant="compact" />
      <NewsChips news={news} palette={palette} />
      <TimeLabel news={news} now={now} palette={palette} />
    </ArticleLink>
  );
}

function EssentialCard({ item, now, palette }: CardProps) {
  const { news } = item;
  return (
    <ArticleLink news={news} style={[styles.essentialCard, { backgroundColor: palette.essential }]}>
      <Text style={[styles.essentialKicker, { color: palette.essentialInk }]}>ESENCIAL</Text>
      <Text style={[styles.essentialTitle, { color: palette.essentialInk }]} numberOfLines={4}>
        {news.title}
      </Text>
      <View style={styles.essentialFooter}>
        <Text style={[styles.essentialMeta, { color: palette.essentialInk }]}>
          {newsLabels(news).topic} · {newsLabels(news).scope}
        </Text>
        <Text style={[styles.essentialMeta, { color: palette.essentialInk }]}>
          {relativePublishedAt(news.publishedAt, now)}
        </Text>
      </View>
      <NewsChips news={news} palette={palette} />
    </ArticleLink>
  );
}

export function MustKnowBlock({
  items,
  now,
  palette,
  expanded,
  onToggle,
}: {
  items: RankedItem[];
  now: Date;
  palette: FeedPalette;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, 5);
  return (
    <View style={styles.mustKnow}>
      <View style={styles.sectionBar}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Lo que debes saber</Text>
        <View style={[styles.sectionRule, { backgroundColor: palette.accent }]} />
      </View>
      <Text style={[styles.sectionSubtitle, { color: palette.secondary }]}>
        Igual para todos en tu zona
      </Text>
      {expanded ? (
        <View style={styles.essentialExpanded}>
          {visible.map((item) => (
            <EssentialCard key={item.news.id} item={item} now={now} palette={palette} />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.essentialScroll}
        >
          {visible.map((item) => (
            <EssentialCard key={item.news.id} item={item} now={now} palette={palette} />
          ))}
        </ScrollView>
      )}
      {items.length > 5 ? (
        <Pressable onPress={onToggle} accessibilityRole="button" style={styles.showAll}>
          <Text style={[styles.showAllText, { color: palette.accent }]}>
            {expanded ? 'Mostrar menos' : `Ver todas (${items.length})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topicMark: { width: 32, height: 4, marginBottom: space.md, borderRadius: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  chip: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4 },
  chipText: { fontSize: feedType.label, fontWeight: '700' },
  time: { fontSize: feedType.label, fontWeight: '600', marginTop: space.sm },
  hero: { borderWidth: 1, borderRadius: 13, overflow: 'hidden', marginBottom: space.xl },
  heroBody: { padding: space.lg, paddingTop: space.md },
  heroTitle: { fontSize: feedType.hero, lineHeight: 32, fontWeight: '900' },
  lead: { fontSize: feedType.body, lineHeight: 20, marginTop: space.sm },
  large: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: space.lg },
  largeBody: { padding: space.lg, paddingTop: space.sm },
  largeTitle: { fontSize: feedType.large, lineHeight: 26, fontWeight: '800' },
  medium: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    padding: space.sm,
    gap: space.md,
    marginBottom: space.md,
  },
  mediumBody: { flex: 1, justifyContent: 'space-between' },
  mediumTitle: { fontSize: feedType.medium, lineHeight: 22, fontWeight: '800' },
  compact: { borderTopWidth: 1, paddingVertical: space.md, marginBottom: space.xs },
  compactTitle: { fontSize: feedType.compact, lineHeight: 21, fontWeight: '700' },
  mustKnow: { marginBottom: space.xl },
  sectionBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sectionTitle: { fontSize: feedType.section, fontWeight: '900' },
  sectionRule: { height: 3, flex: 1, borderRadius: 2 },
  sectionSubtitle: { fontSize: 12, marginTop: 2, marginBottom: space.md },
  essentialScroll: { gap: space.md, paddingRight: space.lg },
  essentialExpanded: { gap: space.md },
  essentialCard: {
    borderRadius: 10,
    padding: space.lg,
    width: 264,
    minHeight: 178,
    justifyContent: 'space-between',
  },
  essentialKicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  essentialTitle: { fontSize: 17, fontWeight: '800', lineHeight: 21, marginTop: space.sm },
  essentialFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  essentialMeta: { fontSize: 11, fontWeight: '600' },
  showAll: { paddingVertical: space.md, alignItems: 'flex-end' },
  showAllText: { fontSize: 13, fontWeight: '800' },
});
