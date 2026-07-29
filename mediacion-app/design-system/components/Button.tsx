import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii } from '../tokens/radii';
import { semanticColors } from '../tokens/colors';
import { typography } from '../tokens/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ai' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZE_STYLE: Record<ButtonSize, { minHeight: number; paddingHorizontal: number; gap: number }> = {
  sm: { minHeight: 36, paddingHorizontal: 14, gap: 6 },
  md: { minHeight: 40, paddingHorizontal: 18, gap: 8 },
  lg: { minHeight: 48, paddingHorizontal: 22, gap: 8 },
};

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: semanticColors.action.primaryBg,
  secondary: semanticColors.action.secondaryBg,
  tertiary: semanticColors.action.tertiaryBg,
  ai: semanticColors.action.aiBg,
  destructive: semanticColors.status.errorBg,
};

const VARIANT_BG_PRESSED: Record<ButtonVariant, string> = {
  primary: semanticColors.action.primaryBgPressed,
  secondary: semanticColors.surface.sunken,
  tertiary: 'rgba(17, 17, 17, 0.09)',
  ai: semanticColors.action.aiBgPressed,
  destructive: semanticColors.status.errorBgPressed,
};

const VARIANT_FG: Record<ButtonVariant, string> = {
  primary: semanticColors.action.primaryFg,
  secondary: semanticColors.action.secondaryFg,
  tertiary: semanticColors.action.tertiaryFg,
  ai: semanticColors.action.aiFg,
  destructive: semanticColors.status.errorFg,
};

/**
 * Mediación primary action control. `ai` (Mediation Sage) is reserved for
 * AI-assisted proposal actions — never mixed with a `primary` charcoal CTA in
 * the same screen. `destructive` is a calm, restrained error tint for
 * irreversible actions (e.g. deleting a position) — not a bright alarm color.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  loadingLabel,
  iconLeft,
  iconRight,
  children,
  onPress,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const sizeStyle = SIZE_STYLE[size];
  const isDisabled = disabled || loading;
  const bg = isDisabled ? semanticColors.action.disabledBg : VARIANT_BG[variant];
  const fg = isDisabled ? semanticColors.action.disabledFg : VARIANT_FG[variant];
  const border = variant === 'secondary' && !isDisabled ? semanticColors.action.secondaryBorder : 'transparent';

  const spinnerSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? loadingLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: sizeStyle.minHeight,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          gap: sizeStyle.gap,
          backgroundColor: pressed && !isDisabled ? VARIANT_BG_PRESSED[variant] : bg,
          borderColor: border,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size={spinnerSize} color={semanticColors.action.disabledFg} />
      ) : iconLeft ? (
        <View>{iconLeft}</View>
      ) : null}
      {loading ? (
        children != null ? (
          <Text style={[styles.label, { color: semanticColors.action.disabledFg }]} numberOfLines={1}>
            {loadingLabel ?? children}
          </Text>
        ) : null
      ) : children != null ? (
        <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
          {children}
        </Text>
      ) : null}
      {!loading && iconRight ? <View>{iconRight}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  label: {
    fontFamily: typography.button.fontFamily,
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
  },
});
