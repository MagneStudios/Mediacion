import { StyleSheet, Text, View } from 'react-native';

import { Input } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { CategoriaPosicion } from '../../../types/position';
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

  return (
    <View style={styles.container}>
      <Input
        label={minLabel}
        value={valueMin}
        onChangeText={onChangeMin}
        error={minError}
        keyboardType={keyboardType}
        editable={!disabled}
      />
      <Input
        label={maxLabel}
        value={valueMax}
        onChangeText={onChangeMax}
        error={maxError}
        keyboardType={keyboardType}
        editable={!disabled}
      />
      <Text style={styles.hint}>{hint}</Text>
      <PrivacyNotice>{privacyText}</PrivacyNotice>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  hint: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
  },
});
