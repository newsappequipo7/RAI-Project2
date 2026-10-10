import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useProfile } from '@/src/profile/ProfileProvider';
import { feedPalette, feedSpacing as space } from '@/src/theme/feed';

export function LocationNotice() {
  const { locationNotice } = useProfile();
  const scheme = useColorScheme();
  const palette = feedPalette[scheme === 'dark' ? 'dark' : 'light'];
  if (!locationNotice) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: palette.chip, borderColor: palette.line }]}
    >
      <Text style={[styles.text, { color: palette.ink }]}>{locationNotice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: 8, padding: space.md, marginBottom: space.md },
  text: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
