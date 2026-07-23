import { StyleSheet, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { Icon, type IconName } from './Icon';
import type { StatusPillStatus } from './StatusPill';

export type EntityTypeIndicatorProps = {
  icon: IconName;
  /** Reuses StatusPill's semantic palette so this chip's color always agrees with any status pill shown alongside it — never a separate color vocabulary. */
  tone?: StatusPillStatus;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
};

const TONE_BG: Record<StatusPillStatus, string> = {
  success: semanticColors.status.successBg,
  warning: semanticColors.status.warningBg,
  error: semanticColors.status.errorBg,
  info: semanticColors.status.infoBg,
  neutral: semanticColors.surface.sunken,
  ai: semanticColors.ai.tint,
};

const TONE_FG: Record<StatusPillStatus, string> = {
  success: semanticColors.status.successFg,
  warning: semanticColors.status.warningFg,
  error: semanticColors.status.errorFg,
  info: semanticColors.status.infoFg,
  neutral: semanticColors.text.secondary,
  ai: semanticColors.ai.accent,
};

const DIMENSION: Record<'sm' | 'md', number> = { sm: 28, md: 36 };
const ICON_SIZE: Record<'sm' | 'md', number> = { sm: 14, md: 18 };

/**
 * Small tinted icon chip identifying what kind of thing a card represents
 * (a case's method, a signature's state) — purely decorative/redundant with
 * text shown next to it, so it's hidden from the accessibility tree unless
 * an explicit accessibilityLabel is passed.
 */
export function EntityTypeIndicator({ icon, tone = 'neutral', size = 'md', accessibilityLabel }: EntityTypeIndicatorProps) {
  const dimension = DIMENSION[size];
  return (
    <View
      style={[styles.base, { width: dimension, height: dimension, borderRadius: radii.md, backgroundColor: TONE_BG[tone] }]}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={accessibilityLabel}
    >
      <Icon name={icon} size={ICON_SIZE[size]} color={TONE_FG[tone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
