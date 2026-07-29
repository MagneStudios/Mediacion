import { StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { MeetingPointEstado } from '../../../types/negotiation';

export type MeetingPointRowProps = {
  /** Already localized by the caller — this component never maps enum to copy. */
  categoryLabel: string;
  /** Localized midpoint, or the caller's placeholder when there is no number. */
  valueLabel: string;
  estado: MeetingPointEstado;
  estadoLabel: string;
};

/**
 * One category of the computed meeting point. The value shown is the derived
 * midpoint the engine produced — never either party's own range, which this
 * screen must never receive in the first place.
 */
export function MeetingPointRow({
  categoryLabel,
  valueLabel,
  estado,
  estadoLabel,
}: MeetingPointRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.category} accessibilityRole="header">
          {categoryLabel}
        </Text>
        <StatusPill status={estado === 'acordable' ? 'success' : 'info'}>
          {estadoLabel}
        </StatusPill>
      </View>
      <Text style={styles.value}>{valueLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  category: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  value: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
