import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';

export type SignatureInboxCardProps = {
  caseTitle: string;
  agreementTitle: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
  dateLabel?: string;
  reviewLabel: string;
  onReview: () => void;
};

/** One signature-inbox entry — no provider IDs, no certificate data, no other party details. Card is non-interactive; the review action is a sibling Button. */
export function SignatureInboxCard({
  caseTitle,
  agreementTitle,
  statusLabel,
  statusVisual,
  dateLabel,
  reviewLabel,
  onReview,
}: SignatureInboxCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.textColumn}>
          <Text style={styles.caseTitle} numberOfLines={1}>
            {caseTitle}
          </Text>
          <Text style={styles.agreementTitle} numberOfLines={1}>
            {agreementTitle}
          </Text>
        </View>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>
      {dateLabel ? (
        <Text style={styles.date} accessibilityLabel={dateLabel}>
          {dateLabel}
        </Text>
      ) : null}
      <Button variant="secondary" fullWidth onPress={onReview}>
        {reviewLabel}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  caseTitle: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  agreementTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  date: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
});
