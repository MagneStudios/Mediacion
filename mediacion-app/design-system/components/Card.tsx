import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/elevation';
import { spacing } from '../tokens/spacing';

if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'card-focus-visible');
    styleTag.textContent =
      `[data-testid="mediacion-card"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser — safe no-op */
  }
}

export type CardVariant = 'default' | 'featured' | 'tinted' | 'guidance' | 'mockup' | 'banner' | 'trust';

export type CardProps = {
  variant?: CardVariant;
  interactive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Supplementary announcement after the label — e.g. a validation error attached to a selectable-card group. */
  accessibilityHint?: string;
  /** Defaults to "button" — override for e.g. a single-select option card ("radio"). */
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const VARIANT_STYLE: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  featured: {
    backgroundColor: semanticColors.text.primary,
    borderColor: semanticColors.text.primary,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  tinted: {
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  guidance: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  mockup: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  banner: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.xxl,
    padding: spacing.xxl,
  },
  trust: {
    backgroundColor: semanticColors.surface.canvas,
    borderRadius: radii.xs,
    padding: spacing.md,
  },
};

/**
 * The dominant surface primitive. Cards never carry a resting-state shadow —
 * depth is the cream→white surface change (see tokens/elevation). Interactive
 * cards strengthen their border on press rather than lifting or scaling.
 */
export function Card({
  variant = 'default',
  interactive = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  children,
  style,
}: CardProps) {
  const base = VARIANT_STYLE[variant];

  if (!interactive) {
    return <View style={[styles.base, base, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      testID="mediacion-card"
      style={({ pressed }) => [
        styles.base,
        base,
        shadows.card,
        pressed && base.borderColor ? { borderColor: semanticColors.text.secondary } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {},
});
