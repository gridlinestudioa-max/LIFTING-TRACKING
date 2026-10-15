import { Text, View } from 'react-native';

import { fonts } from '../theme';

const COLORS = ['#2f6fdf', '#d2552d', '#16916b', '#8e44c9', '#c0397a', '#b38200', '#3a8a9e', '#5c6bc0'];

/** A circle with someone's initials, in a color that stays the same for the same name. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const n = name.trim() || '?';
  const words = n.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : n.slice(0, 2)).toUpperCase();
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS[h % COLORS.length], alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no">
      <Text style={{ color: '#ffffff', fontFamily: fonts.display, fontSize: size * 0.42, lineHeight: size * 0.5 }}>{initials}</Text>
    </View>
  );
}
