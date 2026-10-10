import {
  CERTAINTY_RULES,
  addedCorrections,
  compareSuggestions,
  diffVersions,
  isValidSourceUrl,
  type Certainty,
  type News,
  type Source,
} from '@repo/shared';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewsImage } from '../feed/NewsImage';
import { newsLabels } from '../feed/presentation';
import { feedSpacing as space, type FeedPalette } from '../theme/feed';
import { ArticleBody } from './ArticleBody';

interface DetailProps {
  news: News;
  versions: News[];
  versionsError: string | null;
  palette: FeedPalette;
}

const SOURCE_TYPES: Record<Source['type'], string> = {
  primaria: 'Fuente primaria',
  agencia: 'Agencia',
  medio: 'Medio',
  redes: 'Redes sociales',
  otro: 'Otra fuente',
};
const SUPPORT_LABELS: Record<Source['supports'], string> = {
  confirma: 'Confirma',
  contradice: 'Contradice',
  contexto: 'Da contexto',
};
const CORRECTION_LABELS: Record<News['corrections'][number]['kind'], string> = {
  actualizacion: 'Actualización',
  correccion: 'Corrección',
  retractacion: 'Retractación',
};

function dateTime(value: string | undefined): string {
  const parsed = Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  }).format(new Date(parsed));
}

function openLink(url: string) {
  if (!isValidSourceUrl(url)) return;
  void Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el enlace'));
}

function CertaintyBanner({ news, palette }: { news: News; palette: FeedPalette }) {
  const confirming = news.sources.filter((source) => source.supports === 'confirma').length;
  if (news.certainty === 'confirmada') {
    return (
      <View style={[styles.confirmed, { backgroundColor: '#DFF4E8' }]}>
        <Text style={styles.confirmedText}>
          Confirmada · {confirming} {confirming === 1 ? 'fuente' : 'fuentes'}
        </Text>
      </View>
    );
  }
  const labels: Record<Exclude<Certainty, 'confirmada'>, string> = {
    en_desarrollo: 'Información en desarrollo',
    disputada: 'Las fuentes no coinciden',
    retractada: 'Noticia retractada',
  };
  const retracted = news.certainty === 'retractada';
  const disputed = news.certainty === 'disputada';
  const background = retracted ? '#FDE8E8' : disputed ? '#FFF0DF' : palette.warningSurface;
  const color = retracted ? '#9B1C1C' : disputed ? '#9B4700' : palette.warning;
  const retraction = [...news.corrections].reverse().find((entry) => entry.kind === 'retractacion');
  return (
    <View style={[styles.banner, { backgroundColor: background, borderColor: color }]}>
      <Text style={[styles.bannerTitle, { color }]}>{labels[news.certainty]}</Text>
      {news.certaintyNote || retraction ? (
        <Text style={[styles.bannerBody, { color }]}>
          {retracted ? (retraction?.summary ?? news.certaintyNote) : news.certaintyNote}
        </Text>
      ) : null}
      {retracted ? (
        <Text style={[styles.bannerBody, { color }]}>
          Este contenido se conserva para mostrar la corrección; ya no está vigente.
        </Text>
      ) : null}
    </View>
  );
}

function SourceCard({
  source,
  palette,
  compact = false,
}: {
  source: Source;
  palette: FeedPalette;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.sourceCard,
        compact ? styles.sourceCompact : null,
        { backgroundColor: palette.surface, borderColor: palette.line },
      ]}
    >
      <Text style={[styles.sourceName, { color: palette.ink }]}>{source.name}</Text>
      <Text style={[styles.meta, { color: palette.secondary }]}>
        {source.organization} · {SOURCE_TYPES[source.type]}
      </Text>
      <Text
        style={[
          styles.sourceSupport,
          { color: source.supports === 'contradice' ? palette.warning : palette.accent },
        ]}
      >
        {SUPPORT_LABELS[source.supports]}
      </Text>
      {source.note ? (
        <Text style={[styles.sourceNote, { color: palette.secondary }]}>{source.note}</Text>
      ) : null}
      {!compact ? (
        <Text style={[styles.meta, { color: palette.subtle }]}>
          Consultada: {dateTime(source.accessedAt)}
        </Text>
      ) : null}
      {isValidSourceUrl(source.url) ? (
        <Pressable
          onPress={() => openLink(source.url)}
          accessibilityRole="link"
          accessibilityLabel={`Abrir fuente: ${source.name}`}
        >
          <Text style={[styles.link, { color: palette.accent }]}>Abrir fuente ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DisputedVersions({ news, palette }: { news: News; palette: FeedPalette }) {
  if (news.certainty !== 'disputada') return null;
  const confirming = news.sources.filter((source) => source.supports === 'confirma');
  const contradicting = news.sources.filter((source) => source.supports === 'contradice');
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.ink }]}>Las dos versiones</Text>
      <Text style={[styles.sectionIntro, { color: palette.secondary }]}>{news.certaintyNote}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.disputeColumns}
      >
        <View style={styles.disputeColumn}>
          <Text style={[styles.disputeHeading, { color: palette.ink }]}>Fuentes que confirman</Text>
          {confirming.map((source) => (
            <SourceCard key={source.id} source={source} palette={palette} compact />
          ))}
        </View>
        <View style={styles.disputeColumn}>
          <Text style={[styles.disputeHeading, { color: palette.warning }]}>
            Fuentes que contradicen
          </Text>
          {contradicting.map((source) => (
            <SourceCard key={source.id} source={source} palette={palette} compact />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function VersionHistory({ news, versions, versionsError, palette }: DetailProps) {
  const byVersion = new Map<number, News>(versions.map((version) => [version.version, version]));
  byVersion.set(news.version, news);
  const ordered = [...byVersion.values()].sort((a, b) => b.version - a.version);
  return (
    <View style={styles.subsection}>
      <Text style={[styles.subheading, { color: palette.ink }]}>Versiones y correcciones</Text>
      {versionsError ? (
        <Text style={[styles.meta, { color: palette.warning }]}>{versionsError}</Text>
      ) : null}
      {ordered.map((version, index) => {
        const previous = ordered[index + 1];
        const changes = diffVersions(previous, version);
        const corrections = addedCorrections(previous, version);
        return (
          <View key={version.version} style={[styles.version, { borderColor: palette.line }]}>
            <Text style={[styles.versionTitle, { color: palette.ink }]}>
              Versión {version.version}
              {version.version === news.version ? ' · actual' : ''}
            </Text>
            <Text style={[styles.meta, { color: palette.secondary }]}>
              {dateTime(version.updatedAt)} · {CERTAINTY_RULES[version.certainty].label}
            </Text>
            {corrections.map((entry, entryIndex) => (
              <Text
                key={`${entry.at}-${entryIndex}`}
                style={[styles.versionNote, { color: palette.secondary }]}
              >
                {CORRECTION_LABELS[entry.kind]}: {entry.summary}
              </Text>
            ))}
            {changes.map((change) => (
              <Text key={change.field} style={[styles.versionNote, { color: palette.secondary }]}>
                {change.label}: {change.from} → {change.to}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function NewsDetailContent({ news, versions, versionsError, palette }: DetailProps) {
  const labels = newsLabels(news);
  const retracted = news.certainty === 'retractada';
  const latestCorrection = news.corrections.at(-1);
  const comparisons = compareSuggestions(news);
  const editorialCredit =
    news.bodyOrigin === 'original_editorial'
      ? 'Redacción: equipo editorial'
      : news.bodyOrigin === 'cita_fuente'
        ? 'Contenido citado de fuentes; consulta los enlaces al final'
        : 'Texto generado con IA · revisado por el equipo editorial';
  const certaintyReason =
    news.certaintyNote ??
    (retracted
      ? [...news.corrections].reverse().find((entry) => entry.kind === 'retractacion')?.summary
      : undefined) ??
    `Estado asignado por el equipo editorial según las fuentes registradas (${news.sources.filter((source) => source.supports === 'confirma').length} que confirman).`;

  return (
    <View style={styles.article}>
      <Text style={[styles.eyebrow, { color: palette.accent }]}>
        NOTICIA PUBLICADA · {dateTime(news.publishedAt)}
      </Text>
      <NewsImage news={news} palette={palette} />
      <CertaintyBanner news={news} palette={palette} />
      <Text style={[styles.title, { color: palette.ink }, retracted ? styles.strike : null]}>
        {news.title}
      </Text>
      <Text style={[styles.lead, { color: palette.secondary }, retracted ? styles.strike : null]}>
        {news.lead}
      </Text>
      <View style={styles.chips}>
        {[labels.topic, labels.scope].map((label) => (
          <Text
            key={label}
            style={[styles.chip, { color: palette.ink, backgroundColor: palette.chip }]}
          >
            {label}
          </Text>
        ))}
      </View>
      {latestCorrection ? (
        <View style={[styles.updated, { backgroundColor: palette.chip }]}>
          <Text style={[styles.updatedText, { color: palette.ink }]}>
            {latestCorrection.kind === 'retractacion' ? 'Retractada' : 'Actualizada'}{' '}
            {dateTime(latestCorrection.at)}: {latestCorrection.summary}
          </Text>
        </View>
      ) : null}
      {news.aiSummary ? (
        <View style={[styles.summary, { backgroundColor: palette.chip }]}>
          <Text style={[styles.summaryLabel, { color: palette.accent }]}>
            Resumen generado con IA · revisado por {news.aiSummary.approvedBy}
          </Text>
          <Text style={[styles.summaryText, { color: palette.ink }, retracted ? styles.strike : null]}>
            {news.aiSummary.text}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.origin, { color: palette.subtle }]}>{editorialCredit}</Text>
      <ArticleBody
        body={news.body}
        sources={news.sources}
        palette={palette}
        retracted={retracted}
      />
      <DisputedVersions news={news} palette={palette} />
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>Cómo se hizo esta noticia</Text>
        <Text style={[styles.sectionIntro, { color: palette.secondary }]}>
          La certeza la asignó una persona del equipo editorial. Las fuentes y cambios quedan a la
          vista.
        </Text>
        <View style={styles.subsection}>
          <Text style={[styles.subheading, { color: palette.ink }]}>
            Fuentes ({news.sources.length})
          </Text>
          {news.sources.map((source) => (
            <SourceCard key={source.id} source={source} palette={palette} />
          ))}
        </View>
        <View style={styles.subsection}>
          <Text style={[styles.subheading, { color: palette.ink }]}>Certeza y publicación</Text>
          <Text style={[styles.detailText, { color: palette.secondary }]}>
            {CERTAINTY_RULES[news.certainty].label}: {certaintyReason}
          </Text>
          <Text style={[styles.detailText, { color: palette.secondary }]}>
            Publicado por: {news.publishedBy ?? 'equipo editorial'}
          </Text>
          <Text style={[styles.meta, { color: palette.subtle }]}>
            Publicado: {dateTime(news.publishedAt)} · última actualización:{' '}
            {dateTime(news.updatedAt)}
          </Text>
        </View>
        <View style={styles.subsection}>
          <Text style={[styles.subheading, { color: palette.ink }]}>
            Qué sugirió la IA y qué se publicó
          </Text>
          {comparisons.length ? (
            comparisons.map((entry) => (
              <View key={entry.field} style={[styles.comparison, { borderColor: palette.line }]}>
                <Text style={[styles.comparisonTitle, { color: palette.ink }]}>{entry.label}</Text>
                <Text style={[styles.detailText, { color: palette.secondary }]}>
                  Sugerencia de IA: {entry.suggested}
                </Text>
                <Text style={[styles.detailText, { color: palette.secondary }]}>
                  Publicado por el editor: {entry.published}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.detailText, { color: palette.secondary }]}>
              No se usaron sugerencias de IA para esta noticia.
            </Text>
          )}
        </View>
        <VersionHistory
          news={news}
          versions={versions}
          versionsError={versionsError}
          palette={palette}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  article: { gap: space.lg, paddingBottom: space.xxl },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: space.lg },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  lead: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmed: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  confirmedText: { color: '#12613C', fontSize: 13, fontWeight: '800' },
  banner: { borderWidth: 1, borderRadius: 8, padding: space.md, gap: space.xs },
  bannerTitle: { fontSize: 16, fontWeight: '900' },
  bannerBody: { fontSize: 13, lineHeight: 19 },
  updated: { borderRadius: 6, padding: space.md },
  updatedText: { fontSize: 13, lineHeight: 19 },
  summary: { borderRadius: 8, padding: space.md, gap: space.sm },
  summaryLabel: { fontSize: 12, fontWeight: '800' },
  summaryText: { fontSize: 15, lineHeight: 22 },
  origin: { fontSize: 12, fontWeight: '700' },
  section: { gap: space.md, marginTop: space.lg },
  sectionTitle: { fontSize: 21, fontWeight: '900' },
  sectionIntro: { fontSize: 13, lineHeight: 19 },
  subsection: { gap: space.sm, marginTop: space.md },
  subheading: { fontSize: 17, fontWeight: '800' },
  sourceCard: { borderWidth: 1, borderRadius: 8, padding: space.md, gap: space.xs },
  sourceCompact: { minHeight: 130 },
  sourceName: { fontSize: 14, fontWeight: '800' },
  sourceSupport: { fontSize: 11, fontWeight: '800' },
  sourceNote: { fontSize: 12, lineHeight: 17 },
  meta: { fontSize: 11, lineHeight: 16 },
  link: { fontSize: 12, fontWeight: '800', marginTop: space.xs },
  disputeColumns: { gap: space.md },
  disputeColumn: { width: 210, gap: space.sm },
  disputeHeading: { fontSize: 14, fontWeight: '800' },
  comparison: { borderLeftWidth: 3, paddingLeft: space.md, gap: space.xs },
  comparisonTitle: { fontSize: 13, fontWeight: '800' },
  detailText: { fontSize: 13, lineHeight: 19 },
  version: { borderTopWidth: 1, paddingTop: space.sm, gap: space.xs },
  versionTitle: { fontSize: 13, fontWeight: '800' },
  versionNote: { fontSize: 12, lineHeight: 18 },
});
