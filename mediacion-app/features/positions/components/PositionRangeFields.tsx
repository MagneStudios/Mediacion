import { StyleSheet, Text, View } from 'react-native';

import { Input } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { CategoriaPosicion } from '../../../types/position';
import { useResponsiveLayout } from '../../../hooks/use-responsive-layout';
import { PrivacyNotice } from '../../cases/components/PrivacyNotice';

export type PositionRangeFieldsProps = {
  category: CategoriaPosicion;
  valueMin: string;
  valueMax: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
  minLabel: string;
  maxLabel: string;
  hint: string;
  privacyText: string;
  minError?: string;
  maxError?: string;
  disabled?: boolean;
};

/**
 * Paired min/max range inputs. Only `economico` gets a decimal keypad — every
 * other category stays free text, since the backend stores both in the same
 * `text` column and this app never assumes a category is money.
 */
export function PositionRangeFields({
  category,
  valueMin,
  valueMax,
  onChangeMin,
  onChangeMax,
  minLabel,
  maxLabel,
  hint,
  privacyText,
  minError,
  maxError,
  disabled = false,
}: PositionRangeFieldsProps) {
  const keyboardType = category === 'economico' ? 'decimal-pad' : 'default';
  const { isCompact } = useResponsiveLayout();

  return (
    <View style={styles.container}>
      <View style={[styles.fields, !isCompact ? styles.fieldsWide : null]}>
        <View style={styles.field}>
          <Input
            label={minLabel}
            value={valueMin}
            onChangeText={onChangeMin}
            error={minError}
            keyboardType={keyboardType}
            editable={!disabled}
          />
        </View>
        <View style={styles.field}>
          <Input
            label={maxLabel}
            value={valueMax}
            onChangeText={onChangeMax}
            error={maxError}
            keyboardType={keyboardType}
            editable={!disabled}
          />
        </View>
      </View>
      <Text style={styles.hint}>{hint}</Text>
      <PrivacyNotice>{privacyText}</PrivacyNotice>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  fields: {
    gap: spacing.md,
  },
  fieldsWide: {
    flexDirection: 'row',
  },
  field: {
    flex: 1,
  },
  hint: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
