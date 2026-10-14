import { Image, StyleSheet, Text, View } from 'react-native';

import { BRAND, LOGO } from '@/brand';

import { fonts, radius, useColors } from './theme';

/** The app's logo (from src/brand.ts), or a placeholder mark with the first letter of the name. */
export function Logo({ size = 56 }: { size?: number }) {
  const c = useColors();
  if (LOGO) {
    return <Image source={LOGO} accessibilityLabel={`${BRAND.name} logo`} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return (
    <View
      accessible
      accessibilityLabel={`${BRAND.name} logo`}
      style={[st.mark, { width: size, height: size, borderRadius: Math.round(size * 0.24), backgroundColor: c.accent }]}>
      <Text style={{ color: c.onAccent, fontFamily: fonts.display, fontSize: size * 0.58, lineHeight: size * 0.7 }}>{BRAND.name.charAt(0)}</Text>
    </View>
  );
}

/** Logo beside the app name. */
export function Brand({ size = 44 }: { size?: number }) {
  const c = useColors();
  return (
    <View style={st.row}>
      <Logo size={size} />
      <Text style={[st.name, { color: c.ink, fontSize: size * 0.75, lineHeight: size * 0.85 }]} numberOfLines={1}>
        {BRAND.name}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.display, flexShrink: 1 },
});
