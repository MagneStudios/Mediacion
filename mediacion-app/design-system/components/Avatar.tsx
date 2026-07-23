import { Image, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { fontFamily } from '../tokens/typography';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  name?: string;
  src?: string;
  size?: AvatarSize;
  accessibilityLabel?: string;
};

const SIZE_PX: Record<AvatarSize, number> = { sm: 32, md: 40, lg: 48 };
const FONT_SIZE: Record<AvatarSize, number> = { sm: 12, md: 14, lg: 16 };

function initialsOf(name?: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** Circular avatar — photo when available, initials otherwise. */
export function Avatar({ name = '', src, size = 'md', accessibilityLabel }: AvatarProps) {
  const dimension = SIZE_PX[size];
  return (
    <View
      style={[
        styles.base,
        { width: dimension, height: dimension, borderRadius: radii.full },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? name}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: dimension, height: dimension }} />
      ) : (
        <Text style={[styles.initials, { fontSize: FONT_SIZE[size] }]}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    overflow: 'hidden',
    flexShrink: 0,
  },
  initials: {
    fontFamily: fontFamily.medium,
    color: semanticColors.text.secondary,
  },
});
