import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { StatusPill } from './StatusPill';

export type AIProcessingStateProps = {
  badgeLabel: string;
  statusLabel: string;
  description: string;
};

/**
 * Non-blocking AI-proposal pending state. Always paired with the sage
 * "Asistido por IA" badge and a pulsing status pill — never implies the
 * system is deciding or judging, only suggesting while the user keeps
 * control of the surrounding screen.
 */
export function AIProcessingState({ badgeLabel, statusLabel, description }: AIProcessingStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Badge variant="ai" iconLeft={<Icon name="sparkles" size={12} color={semanticColors.ai.accent} />}>
          {badgeLabel}
        </Badge>
        <StatusPill status="ai" pulse>
          {statusLabel}
        </StatusPill>
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: semanticColors.ai.tint,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: semanticColors.ai.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: semanticColors.text.secondary,
  },
});
