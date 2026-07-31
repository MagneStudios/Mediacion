import { StyleSheet, Text, View } from 'react-native';

import { Card, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { SharedSignerStatus } from '../../../types/agreement';
import { SignerStatusRow } from './SignerStatusRow';

export type SignatureProgressCardProps = {
  title: string;
  signers: SharedSignerStatus[];
  ownRoleLabel: string;
  otherRoleLabel: string;
  signedStatusLabel: string;
  pendingStatusLabel: string;
  formatDate: (iso: string) => string;
};

/** Signer progress — role labels only, never a name or identifier. */
export function SignatureProgressCard({
  title,
  signers,
  ownRoleLabel,
  otherRoleLabel,
  signedStatusLabel,
  pendingStatusLabel,
  formatDate,
}: SignatureProgressCardProps) {
  const own = signers.find((signer) => signer.role === 'authenticated_party');
  const other = signers.find((signer) => signer.role === 'other_party');

  const allSigned = own?.status === 'firmado' && other?.status === 'firmado';

  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <SignerStatusRow
        roleLabel={ownRoleLabel}
        statusLabel={own?.status === 'firmado' ? signedStatusLabel : pendingStatusLabel}
        signed={own?.status === 'firmado'}
        dateLabel={own?.signedAt ? formatDate(own.signedAt) : undefined}
      />
      <SignerStatusRow
        roleLabel={otherRoleLabel}
        statusLabel={other?.status === 'firmado' ? signedStatusLabel : pendingStatusLabel}
        signed={other?.status === 'firmado'}
        dateLabel={other?.signedAt ? formatDate(other.signedAt) : undefined}
      />
      {allSigned ? (
        <View style={styles.completionFooter}>
          <Icon name="shield-check" size={16} color={semanticColors.ai.accent} />
          <Text style={styles.completionText}>{signedStatusLabel}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: semanticColors.text.tertiary,
  },
  completionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  completionText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: semanticColors.ai.accent,
  },
});
