import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Icon, StatusPill } from '../../../../design-system';
import { semanticColors } from '../../../../design-system/tokens/colors';
import { radii } from '../../../../design-system/tokens/radii';
import { spacing } from '../../../../design-system/tokens/spacing';
import { typography } from '../../../../design-system/tokens/typography';
import type { Plan } from '../../../../types/plan';
import { formatPlanLimit, formatPlanPrice } from '../../../../utils/format-plan-limit';

export type PlanCardProps = {
  plan: Plan;
  casosLabel: string;
  carpetasLabel: string;
  iteracionesLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  editAccessibilityLabel: string;
  deleteAccessibilityLabel: string;
};

/**
 * One plan row in the R-10 admin ABM. Mirrors PositionCard's structure: a
 * non-interactive outer Card, edit/delete as sibling Pressables (never
 * nested inside another Pressable/button).
 */
export function PlanCard({
  plan,
  casosLabel,
  carpetasLabel,
  iteracionesLabel,
  onEdit,
  onDelete,
  editAccessibilityLabel,
  deleteAccessibilityLabel,
}: PlanCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{plan.nombre}</Text>
          <Text style={styles.price}>{formatPlanPrice(plan.precio)}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={editAccessibilityLabel}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.iconButtonPressed : null]}
          >
            <Icon name="pencil" size={17} color={semanticColors.text.secondary} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={deleteAccessibilityLabel}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.iconButtonPressed : null]}
          >
            <Icon name="trash-2" size={17} color={semanticColors.status.errorFg} />
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <StatusPill status="neutral">{`${casosLabel}: ${formatPlanLimit(plan.limiteCasos)}`}</StatusPill>
        <StatusPill status="neutral">{`${carpetasLabel}: ${formatPlanLimit(plan.limiteCarpetas)}`}</StatusPill>
        <StatusPill status="neutral">{`${iteracionesLabel}: ${formatPlanLimit(plan.limiteIteracionesIa)}`}</StatusPill>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
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
  actions: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: semanticColors.surface.sunken,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
