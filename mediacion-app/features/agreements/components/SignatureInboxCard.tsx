import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Divider, Icon, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { IconName } from '../../../design-system/components/Icon';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';

export type SignatureInboxCardProps = {
  caseTitle: string;
  agreementTitle: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
  statusIcon: IconName;
  dateLabel?: string;
  reviewLabel: string;
  onReview: () => void;
};

export function SignatureInboxCard({
  caseTitle,
  agreementTitle,
  statusLabel,
  statusVisual,
  statusIcon,
  dateLabel,
  reviewLabel,
  onReview,
}: SignatureInboxCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Icon name="file-signature" size={20} color={semanticColors.text.secondary} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.topRow}>
            <Text style={styles.caseLabel} numberOfLines={1}>{caseTitle}</Text>
            <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
          </View>
          <Text style={styles.agreementTitle} numberOfLines={2}>{agreementTitle}</Text>
        </View>
      </View>

      {dateLabel ? (
        <View style={styles.dateRow}>
          <Icon name="clock" size={14} color={semanticColors.text.tertiary} />
          <Text style={styles.date} accessibilityLabel={dateLabel}>{dateLabel}</Text>
        </View>
      ) : null}

      <Divider tone="soft" />

      <View style={styles.footer}>
        <Button variant="secondary" size="sm" onPress={onReview} iconRight={<Icon name="chevron-right" size={14} color={semanticColors.action.secondaryFg} />}>
          {reviewLabel}
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  caseLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: semanticColors.text.tertiary,
    flexShrink: 1,
  },
  agreementTitle: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 17,
    letterSpacing: -0.2,
    lineHeight: 23,
    color: semanticColors.text.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  date: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    color: semanticColors.text.tertiary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
