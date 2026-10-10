import {
  AI_ILLUSTRATION_DISCLOSURE,
  buildCoverImage,
  imageCaption,
  isValidSourceUrl,
  type News,
  type NewsImage as NewsImageData,
} from '@repo/shared';
import { useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverArt } from './CoverArt';
import { feedSpacing as space, type FeedPalette } from '../theme/feed';

export type ImageVariant = 'wide' | 'mini' | 'compact';

const kindNames: Record<NewsImageData['kind'], string> = {
  foto_real: 'Fotografía del hecho',
  licencia_libre: 'Imagen de archivo con licencia libre',
  portada_generada: 'Portada tipográfica generada por código',
  ilustracion_ia: 'Ilustración generada con IA',
};

export function NewsImage({
  news,
  palette,
  variant = 'wide',
}: {
  news: News;
  palette: FeedPalette;
  variant?: ImageVariant;
}) {
  const image = news.image ?? buildCoverImage(news.title);
  const caption = imageCaption(image);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const isCover = image.kind === 'portada_generada';
  const imageAvailable = isValidSourceUrl(image.url);
  const licenseAvailable = image.licenseUrl ? isValidSourceUrl(image.licenseUrl) : false;
  const sourceAvailable = image.sourceUrl ? isValidSourceUrl(image.sourceUrl) : false;
  const origin = sourceAvailable
    ? image.sourceUrl!
    : isCover || image.kind === 'ilustracion_ia'
      ? 'Generada para esta noticia'
      : 'Enlace de origen no disponible';

  function stopAndOpen(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    setDetailsOpen(true);
  }

  function toggleTooltip(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    setTooltipOpen((previous) => !previous);
  }

  const details = (
    <Modal
      visible={detailsOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailsOpen(false)}
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setDetailsOpen(false)}
          accessibilityLabel="Cerrar detalles de imagen"
        />
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: palette.ink }]}>Sobre esta imagen</Text>
            <Pressable
              onPress={() => setDetailsOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar detalles de imagen"
            >
              <Text style={[styles.close, { color: palette.accent }]}>Cerrar</Text>
            </Pressable>
          </View>
          <Detail label="Tipo" value={kindNames[image.kind]} palette={palette} />
          <Detail label="Autor o crédito" value={image.credit} palette={palette} />
          <Detail
            label="Licencia o permiso"
            value={image.license ?? 'No aplica'}
            palette={palette}
          />
          {licenseAvailable ? (
            <Pressable
              onPress={() =>
                void Linking.openURL(image.licenseUrl!).catch(() =>
                  Alert.alert('No se pudo abrir el enlace'),
                )
              }
              accessibilityRole="link"
            >
              <Text style={[styles.sourceLink, { color: palette.accent }]}>
                Ver condiciones de la licencia ↗
              </Text>
            </Pressable>
          ) : null}
          <Detail label="Origen" value={origin} palette={palette} />
          {sourceAvailable ? (
            <Pressable
              onPress={() =>
                void Linking.openURL(image.sourceUrl!).catch(() =>
                  Alert.alert('No se pudo abrir el enlace'),
                )
              }
              accessibilityRole="link"
            >
              <Text style={[styles.sourceLink, { color: palette.accent }]}>
                Abrir enlace de origen ↗
              </Text>
            </Pressable>
          ) : null}
          {image.kind === 'ilustracion_ia' ? (
            <Text
              style={[
                styles.warning,
                { color: palette.warning, backgroundColor: palette.warningSurface },
              ]}
            >
              {image.aiDisclosure ?? AI_ILLUSTRATION_DISCLOSURE}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  if (variant === 'compact') {
    return (
      <View style={styles.compactWrap}>
        <Pressable
          onPress={toggleTooltip}
          accessibilityRole="button"
          accessibilityLabel={`Información de imagen: ${caption}`}
          style={[styles.infoIcon, { borderColor: palette.subtle }]}
        >
          <Text style={[styles.infoText, { color: palette.subtle }]}>ⓘ</Text>
        </Pressable>
        {tooltipOpen ? (
          <View
            style={[styles.tooltip, { backgroundColor: palette.chip, borderColor: palette.line }]}
          >
            <Text style={{ color: palette.ink, fontSize: 11 }}>{caption}</Text>
            <Pressable onPress={stopAndOpen} accessibilityRole="button">
              <Text
                style={{
                  color: palette.accent,
                  fontSize: 11,
                  fontWeight: '700',
                  marginTop: space.xs,
                }}
              >
                Ver procedencia
              </Text>
            </Pressable>
          </View>
        ) : null}
        {details}
      </View>
    );
  }

  return (
    <View style={variant === 'mini' ? styles.miniWrap : styles.wideWrap}>
      <Pressable
        onPress={stopAndOpen}
        accessibilityRole="button"
        accessibilityLabel={`Ver procedencia de imagen: ${caption}`}
      >
        {isCover ? (
          <CoverArt news={news} />
        ) : imageAvailable ? (
          <View>
            <Image
              source={{ uri: image.url }}
              style={styles.artwork}
              resizeMode="cover"
              accessibilityLabel={image.altText}
            />
            {image.kind === 'ilustracion_ia' ? (
              <Text style={styles.aiSeal}>Ilustración IA</Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.artwork, styles.missing, { backgroundColor: palette.chip }]}>
            <Text style={{ color: palette.secondary }}>Imagen no disponible</Text>
          </View>
        )}
      </Pressable>
      <Text
        style={[
          variant === 'mini' ? styles.miniCaption : styles.caption,
          { color: palette.subtle },
        ]}
      >
        {caption}
      </Text>
      {details}
    </View>
  );
}

function Detail({ label, value, palette }: { label: string; value: string; palette: FeedPalette }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: palette.subtle }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wideWrap: { width: '100%' },
  miniWrap: { width: 120, flexShrink: 0 },
  artwork: { width: '100%', aspectRatio: 16 / 9 },
  missing: { alignItems: 'center', justifyContent: 'center' },
  aiSeal: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: '#101820',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    padding: 5,
  },
  caption: { fontSize: 11, paddingHorizontal: space.lg, paddingTop: space.xs },
  miniCaption: { fontSize: 9, paddingTop: space.xs },
  compactWrap: { alignSelf: 'flex-start', marginTop: space.xs },
  infoIcon: {
    borderWidth: 1,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { fontSize: 15, lineHeight: 19 },
  tooltip: {
    borderWidth: 1,
    borderRadius: 6,
    padding: space.sm,
    maxWidth: 250,
    marginTop: space.xs,
  },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: space.xl,
    paddingBottom: 40,
    gap: space.sm,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 21, fontWeight: '800' },
  close: { fontSize: 14, fontWeight: '700' },
  detailRow: { marginTop: space.xs },
  detailLabel: { fontSize: 12, fontWeight: '700' },
  detailValue: { fontSize: 15, marginTop: 2 },
  sourceLink: { fontSize: 14, fontWeight: '700', marginTop: space.xs },
  warning: { fontSize: 13, padding: space.sm, borderRadius: 6, marginTop: space.xs },
});
