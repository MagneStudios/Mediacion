import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../../../design-system/components/Icon';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { NoticeCategory } from '../../../types/notice';

const CATEGORY_ICON: Record<NoticeCategory, IconName> = {
  case: 'folder',
  invitation: 'send',
  proposal: 'file-check-2',
  response: 'check',
  round: 'clock',
  agreement: 'scale',
  signature: 'file-signature',
  mediator: 'user',
  deadline: 'alert-circle',
  institutional: 'info',
  system: 'bell',
};

export type NoticeCategoryTone = 'neutral' | 'info' | 'success' | 'warning';

const CATEGORY_TONE: Record<NoticeCategory, NoticeCategoryTone> = {
  case: 'neutral',
  invitation: 'neutral',
  proposal: 'neutral',
  response: 'success',
  round: 'neutral',
  agreement: 'success',
  signature: 'success',
  mediator: 'info',
  deadline: 'warning',
  institutional: 'info',
  system: 'info',
};

const TONE_STYLE: Record<NoticeCategoryTone, { bg: string; fg: string; border: string }> = {
  neutral: {
    bg: semanticColors.surface.sunken,
    fg: semanticColors.text.secondary,
    border: semanticColors.border.soft,
  },
  info: {
    bg: semanticColors.status.infoBg,
    fg: semanticColors.status.infoFg,
    border: semanticColors.border.default,
  },
  success: {
    bg: semanticColors.status.successBg,
    fg: semanticColors.status.successFg,
    border: semanticColors.status.successBg,
  },
  warning: {
    bg: semanticColors.status.warningBg,
    fg: semanticColors.status.warningFg,
    border: semanticColors.status.warningBg,
  },
};

export function getNoticeCategoryTone(category: NoticeCategory): NoticeCategoryTone {
  return CATEGORY_TONE[category];
}

export type NoticeCategoryBadgeProps = {
  category: NoticeCategory;
  label: string;
};

/** Category marker using only existing semantic tones; mediation aqua remains reserved for AI-assisted actions. */
export function NoticeCategoryBadge({ category, label }: NoticeCategoryBadgeProps) {
  const tone = TONE_STYLE[getNoticeCategoryTone(category)];

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Icon name={CATEGORY_ICON[category]} size={13} color={tone.fg} />
      <Text style={[styles.label, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  label: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    lineHeight: 15,
  },
});
