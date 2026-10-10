import { isValidSourceUrl, type Source } from '@repo/shared';
import type { ReactNode } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { feedSpacing as space, type FeedPalette } from '../theme/feed';

interface ArticleBodyProps {
  body: string;
  sources: Source[];
  palette: FeedPalette;
  retracted: boolean;
}

function openSource(url: string) {
  if (!isValidSourceUrl(url)) return;
  void Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el enlace'));
}

/** The editor uses simple Markdown; render its text, links, headings, lists and attributed quotes natively. */
export function ArticleBody({ body, sources, palette, retracted }: ArticleBodyProps) {
  const blocks = body
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);
  const strike = retracted ? styles.strike : undefined;

  function inline(value: string): ReactNode[] {
    return value
      .split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g)
      .filter(Boolean)
      .map((part, index) => {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          const label = link[1] ?? '';
          const url = link[2] ?? '';
          if (isValidSourceUrl(url)) {
            return (
              <Text
                key={index}
                style={{ color: palette.accent, textDecorationLine: 'underline' }}
                onPress={() => openSource(url)}
                accessibilityRole="link"
              >
                {label}
              </Text>
            );
          }
          return <Text key={index}>{label}</Text>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={index} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <Text key={index} style={styles.italic}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      });
  }

  return (
    <View style={styles.body}>
      {blocks.map((block, index) => {
        const lines = block.split('\n').map((line) => line.trimEnd());
        if (lines.every((line) => /^>\s?/.test(line))) {
          const quote = lines.map((line) => line.replace(/^>\s?/, '')).join('\n');
          const attributed = sources.find((source) =>
            quote.toLowerCase().includes(source.name.toLowerCase()),
          );
          return (
            <View
              key={index}
              style={[
                styles.quote,
                { borderLeftColor: palette.accent, backgroundColor: palette.chip },
              ]}
            >
              <Text style={[styles.quoteText, { color: palette.ink }, strike]}>
                {inline(quote)}
              </Text>
              {attributed && isValidSourceUrl(attributed.url) ? (
                <Pressable onPress={() => openSource(attributed.url)} accessibilityRole="link">
                  <Text style={[styles.attribution, { color: palette.accent }]}>
                    Fuente: {attributed.name} ↗
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.attribution, { color: palette.subtle }]}>
                  Cita de fuente · consulta las fuentes al final
                </Text>
              )}
            </View>
          );
        }
        if (/^#{1,3}\s/.test(block)) {
          return (
            <Text key={index} style={[styles.heading, { color: palette.ink }, strike]}>
              {inline(block.replace(/^#{1,3}\s+/, ''))}
            </Text>
          );
        }
        if (lines.every((line) => /^([-*]\s|\d+\.\s)/.test(line))) {
          return (
            <View key={index} style={styles.list}>
              {lines.map((line, lineIndex) => (
                <Text key={lineIndex} style={[styles.paragraph, { color: palette.ink }, strike]}>
                  {/^\d+\.\s/.test(line) ? `${lineIndex + 1}. ` : '• '}
                  {inline(line.replace(/^([-*]\s|\d+\.\s)/, ''))}
                </Text>
              ))}
            </View>
          );
        }
        return (
          <Text key={index} style={[styles.paragraph, { color: palette.ink }, strike]}>
            {inline(lines.join('\n'))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  paragraph: { fontSize: 16, lineHeight: 25 },
  quote: { borderLeftWidth: 4, borderRadius: 4, padding: space.md, gap: space.sm },
  quoteText: { fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  attribution: { fontSize: 12, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 24, fontWeight: '800' },
  list: { gap: space.xs },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
});
