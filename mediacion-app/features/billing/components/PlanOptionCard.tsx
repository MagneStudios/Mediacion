import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, StatusPill } from '../../../design-system';
import { radii } from '../../../design-system/tokens/radii';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { Plan } from '../../../types/plan';
import { formatPlanLimit, formatPlanPrice } from '../../../utils/format-plan-limit';

export type PlanOptionCardProps = {
  plan: Plan;
  isCurrent: boolean;
  currentBadgeLabel: string;
  casosLabel: string;
  carpetasLabel: string;
  iteracionesLabel: string;
  subscribeLabel: string;
  onSubscribe: () => void;
  disabled?: boolean;
};

/**
 * One plan a party can subscribe to (R-09 checkout entry point). Reuses the
 * same limit-sentinel formatting the admin ABM cards use (`PlanCard.tsx`,
 * R-10) so "ilimitado" reads identically everywhere in the app.
 */
export function PlanOptionCard({
  plan,
  isCurrent,
  currentBadgeLabel,
  casosLabel,
  carpetasLabel,
  iteracionesLabel,
  subscribeLabel,
  onSubscribe,
  disabled = false,
}: PlanOptionCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{plan.nombre}</Text>
          <Text style={styles.price}>{formatPlanPrice(plan.precio)}</Text>
        </View>
        {isCurrent ? <Badge variant="neutral">{currentBadgeLabel}</Badge> : null}
      </View>

      <View style={styles.limits}>
        <StatusPill status="neutral">{`${casosLabel}: ${formatPlanLimit(plan.limiteCasos)}`}</StatusPill>
        <StatusPill status="neutral">{`${carpetasLabel}: ${formatPlanLimit(plan.limiteCarpetas)}`}</StatusPill>
        <StatusPill status="neutral">{`${iteracionesLabel}: ${formatPlanLimit(plan.limiteIteracionesIa)}`}</StatusPill>
      </View>

      {isCurrent ? null : (
        <Button variant="primary" fullWidth onPress={onSubscribe} disabled={disabled}>
          {subscribeLabel}
        </Button>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodyLg,
    textTransform: 'capitalize',
    color: semanticColors.text.primary,
  },
  price: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  limits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
