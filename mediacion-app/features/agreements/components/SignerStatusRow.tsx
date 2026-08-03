import { StyleSheet, Text, View } from 'react-native';

import { Icon, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type SignerStatusRowProps = {
  roleLabel: string;
  statusLabel: string;
  signed: boolean;
  dateLabel?: string;
};

/** One signer's status — no name, no identifier, just the role label ("Vos" / "La otra parte") and a mock status. */
export function SignerStatusRow({ roleLabel, statusLabel, signed, dateLabel }: SignerStatusRowProps) {
  return (
    <View style={styles.row}>
      <Icon name={signed ? 'check' : 'clock'} size={16} color={signed ? semanticColors.status.successFg : semanticColors.text.tertiary} />
      <View style={styles.textColumn}>
        <Text style={styles.roleLabel}>{roleLabel}</Text>
        {dateLabel ? (
          <Text style={styles.dateLabel} accessibilityLabel={dateLabel}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
      <StatusPill status={signed ? 'success' : 'neutral'}>{statusLabel}</StatusPill>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  textColumn: {
    flex: 1,
    minWidth: 140,
    gap: spacing.xxs,
  },
  roleLabel: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
  dateLabel: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
