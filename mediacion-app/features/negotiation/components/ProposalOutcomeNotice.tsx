import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../../../design-system';
import { Text } from '../../../design-system/components/Text';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';

export type ProposalOutcomeTone = 'success' | 'neutral';

export type ProposalOutcomeNoticeProps = {
  title: string;
  description: string;
  tone?: ProposalOutcomeTone;
  /** Optional real action for what happens next (e.g. "Revisar acuerdo") — never invented here, always passed in from the caller's own real callback. */
  action?: ReactNode;
};

const TONE_ICON: Record<ProposalOutcomeTone, IconName> = {
  success: 'check',
  neutral: 'info',
};

const TONE_BG: Record<ProposalOutcomeTone, string> = {
  success: semanticColors.status.successBg,
  neutral: semanticColors.surface.sunken,
};

const TONE_FG: Record<ProposalOutcomeTone, string> = {
  success: semanticColors.status.successFg,
  neutral: semanticColors.text.secondary,
};

/**
 * "What happens next" — surfaces the round's real outcome (both parties
 * accepted, or no agreement reached this round) as a calm, non-decisive
 * notice. Purely presentational: the caller decides tone/copy/action from
 * already-real state (`bothAccepted`, `roundResolved`), this component never
 * infers or invents an outcome of its own.
 */
export function ProposalOutcomeNotice({ title, description, tone = 'neutral', action }: ProposalOutcomeNoticeProps) {
  return (
    <View style={[styles.container, { backgroundColor: TONE_BG[tone] }]}>
      <Icon name={TONE_ICON[tone]} size={16} color={TONE_FG[tone]} />
      <View style={styles.body}>
        <Text variant="eyebrow" style={{ color: TONE_FG[tone] }}>
          {title}
        </Text>
        <Text variant="bodySm" color="secondary">
          {description}
        </Text>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  action: {
    marginTop: spacing.sm,
  },
});
