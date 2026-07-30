import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { typography } from '../tokens/typography';

export type BadgeVariant = 'neutral' | 'solid' | 'outline' | 'ai';

export type BadgeProps = {
  variant?: BadgeVariant;
  size?: 'md' | 'lg';
  iconLeft?: ReactNode;
  children?: ReactNode;
};

const VARIANT_STYLE: Record<BadgeVariant, { bg: string; fg: string; borderColor?: string }> = {
  neutral: { bg: semanticColors.surface.sunken, fg: semanticColors.text.secondary },
  solid: { bg: colors.ink, fg: colors.onPrimary },
  outline: { bg: 'transparent', fg: semanticColors.text.primary, borderColor: semanticColors.border.default },
  ai: { bg: semanticColors.ai.tint, fg: semanticColors.ai.accent },
};

/**
 * Small label. `ai` (sage on soft sage tint) marks the "Asistido por IA"
 * badge — the only decorative use of Mediation Sage besides the AI button.
 */
export function Badge({ variant = 'neutral', size = 'md', iconLeft, children }: BadgeProps) {
  const variantStyle = VARIANT_STYLE[variant];
  return (
    <View
      style={[
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: variantStyle.bg, borderColor: variantStyle.borderColor ?? 'transparent' },
      ]}
    >
      {iconLeft ? <View>{iconLeft}</View> : null}
      <Text style={[styles.label, size === 'lg' && styles.labelLg, { color: variantStyle.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  lg: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  label: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
  },
  labelLg: {
    fontSize: 13,
  },
});
