import { buildCoverSpec, wrapCoverTitle, type News } from '@repo/shared';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

/** The portal and mobile cover use the same spec, title wrapping and 16:9 geometry. */
export function CoverArt({ news }: { news: News }) {
  const spec = buildCoverSpec(news);
  const [width, setWidth] = useState(320);
  const height = (width * spec.aspect.height) / spec.aspect.width;
  const padding = height * spec.layout.padding;
  const lines = wrapCoverTitle(spec.title, 22);

  function measure(event: LayoutChangeEvent) {
    const measured = event.nativeEvent.layout.width;
    if (measured > 0 && measured !== width) setWidth(measured);
  }

  return (
    <View
      onLayout={measure}
      style={[
        styles.cover,
        { backgroundColor: spec.background, aspectRatio: spec.aspect.width / spec.aspect.height },
      ]}
      accessibilityLabel={`Portada generada: ${spec.title}. ${spec.caption}`}
    >
      {spec.kicker ? (
        <Text
          numberOfLines={1}
          style={[
            styles.kicker,
            {
              left: padding,
              top: padding,
              color: spec.foreground,
              fontSize: height * spec.layout.kickerSize,
            },
          ]}
        >
          {spec.kicker}
        </Text>
      ) : null}
      <View
        style={[
          styles.title,
          { left: padding, right: padding, top: padding + height * spec.layout.kickerSize * 1.9 },
        ]}
      >
        {lines.map((line, index) => (
          <Text
            key={`${index}-${line}`}
            numberOfLines={1}
            style={{
              color: spec.foreground,
              fontSize: height * spec.layout.titleSize,
              lineHeight: height * spec.layout.titleSize * spec.layout.titleLineHeight,
              fontWeight: '800',
            }}
          >
            {line}
          </Text>
        ))}
      </View>
      <View style={[styles.footer, { left: padding, right: padding, bottom: padding }]}>
        {spec.place ? (
          <Text
            numberOfLines={1}
            style={[
              styles.place,
              { color: spec.foreground, fontSize: height * spec.layout.placeSize },
            ]}
          >
            {spec.place}
          </Text>
        ) : (
          <View style={styles.place} />
        )}
        <Text
          numberOfLines={1}
          style={[
            styles.caption,
            { color: spec.foreground, fontSize: height * spec.layout.captionSize },
          ]}
        >
          {spec.caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', overflow: 'hidden' },
  kicker: { position: 'absolute', fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  title: { position: 'absolute' },
  footer: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  place: { flex: 1, opacity: 0.9 },
  caption: { flexShrink: 0, opacity: 0.8 },
});
