import Svg, { Circle, Path } from 'react-native-svg';

export type MarkKind = 'done' | 'missed' | 'partial';

/**
 * Status marks drawn as vector icons, so they look the same on every phone and browser
 * (the ◐ character in particular is missing from some system fonts).
 */
export function StatusMark({ kind, color, size = 14 }: { kind: MarkKind; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {kind === 'done' ? (
        <Path d="M3 8.5l3.2 3.2L13 4.8" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      ) : kind === 'missed' ? (
        <Path d="M4 4l8 8M12 4l-8 8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      ) : (
        <>
          <Circle cx={8} cy={8} r={5.6} stroke={color} strokeWidth={1.8} />
          <Path d="M8 2.4A5.6 5.6 0 0 0 8 13.6Z" fill={color} />
        </>
      )}
    </Svg>
  );
}
