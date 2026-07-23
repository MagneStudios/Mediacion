import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { typography } from '../tokens/typography';
import { duration, easing } from '../tokens/motion';

export type StatusPillStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'ai';

export type StatusPillProps = {
  status?: StatusPillStatus;
  size?: 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  children?: ReactNode;
};

const VARIANT_STYLE: Record<StatusPillStatus, { bg: string; fg: string }> = {
  success: { bg: semanticColors.status.successBg, fg: semanticColors.status.successFg },
  warning: { bg: semanticColors.status.warningBg, fg: semanticColors.status.warningFg },
  error: { bg: semanticColors.status.errorBg, fg: semanticColors.status.errorFg },
  info: { bg: semanticColors.status.infoBg, fg: semanticColors.status.infoFg },
  neutral: { bg: semanticColors.status.neutralBg, fg: semanticColors.status.neutralFg },
  ai: { bg: semanticColors.ai.tint, fg: semanticColors.ai.accent },
};

/**
 * Case / round / proposal / agreement / payment / signature / SLA status.
 * The colored dot is always paired with a text label so color is never the
 * only signal. `ai` + `pulse` marks the non-blocking AI-proposal pending
 * state.
 */
export function StatusPill({ status = 'neutral', size = 'md', dot = true, pulse = false, children }: StatusPillProps) {
  const v = VARIANT_STYLE[status];
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: duration.aiPulse / 2,
          easing: easing.standard,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: duration.aiPulse / 2,
          easing: easing.standard,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, opacity]);

  return (
    <View style={[styles.base, size === 'lg' && styles.lg, { backgroundColor: v.bg }]}>
      {dot ? <Animated.View style={[styles.dot, { backgroundColor: v.fg, opacity }]} /> : null}
      <Text style={[styles.label, size === 'lg' && styles.labelLg, { color: v.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 9,
    alignSelf: 'flex-start',
  },
  lg: {
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  label: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
  },
  labelLg: {
    fontSize: 13,
  },
});
