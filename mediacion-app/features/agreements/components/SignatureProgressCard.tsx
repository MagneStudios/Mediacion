import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 13,
    color: semanticColors.text.primary,
  },
});
