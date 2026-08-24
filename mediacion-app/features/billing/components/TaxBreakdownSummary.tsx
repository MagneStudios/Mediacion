import { StyleSheet, Text, View } from 'react-native';

import { Card, Divider } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { TaxBreakdown } from '../../../types/billing';
import { formatPlanPrice } from '../../../utils/format-plan-limit';

export type TaxBreakdownSummaryProps = {
  breakdown: TaxBreakdown;
  /** Punto #24: the currency comes in as data (plan/invoice), never as a literal here. */
  moneda: string;
  netoLabel: string;
  ivaLabel: string;
  otrosImpuestosLabel: string;
  totalLabel: string;
};

/**
 * R-09: "importes discriminados" — neto, IVA, otros impuestos and total
 * always shown as separate lines, never pre-summed into a single number.
 * `otrosImpuestos` still renders even at 0 (the current AR config), so the
 * line item exists in the UI the moment a country config actually charges
 * one — no conditional hiding that would need a second code path later.
 */
export function TaxBreakdownSummary({ breakdown, moneda, netoLabel, ivaLabel, otrosImpuestosLabel, totalLabel }: TaxBreakdownSummaryProps) {
  return (
    <Card style={styles.card}>
      <Row label={netoLabel} value={formatPlanPrice(breakdown.neto, moneda)} />
      <Row label={ivaLabel} value={formatPlanPrice(breakdown.iva, moneda)} />
      <Row label={otrosImpuestosLabel} value={formatPlanPrice(breakdown.otrosImpuestos, moneda)} />
      <Divider tone="soft" />
      <Row label={totalLabel} value={formatPlanPrice(breakdown.total, moneda)} emphasized />
    </Card>
  );
}

function Row({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, emphasized && styles.labelEmphasized]}>{label}</Text>
      <Text style={[styles.value, emphasized && styles.valueEmphasized]}>{value}</Text>
    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  labelEmphasized: {
    ...typography.bodyLg,
    color: semanticColors.text.primary,
  },
  value: {
    ...typography.bodySm,
    color: semanticColors.text.primary,
  },
  valueEmphasized: {
    ...typography.bodyLg,
    color: semanticColors.text.primary,
  },
});
