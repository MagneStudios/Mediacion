import { View, StyleSheet } from 'react-native';

import { Button } from '../../../design-system';
import { spacing } from '../../../design-system/tokens/spacing';

export type ProposalResponseActionsProps = {
  acceptLabel: string;
  rejectLabel: string;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
};

/**
 * Accept/reject are party decisions, not AI actions — neither uses the sage
 * `ai` button variant. Both open a confirmation step (see
 * ProposalResponseDialog) rather than submitting immediately.
 */
export function ProposalResponseActions({ acceptLabel, rejectLabel, onAccept, onReject, disabled }: ProposalResponseActionsProps) {
  return (
    <View style={styles.row}>
      <Button variant="primary" size="lg" fullWidth onPress={onAccept} disabled={disabled}>
        {acceptLabel}
      </Button>
      <Button variant="secondary" size="lg" fullWidth onPress={onReject} disabled={disabled}>
        {rejectLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
  },
});
