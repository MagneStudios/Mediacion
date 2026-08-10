import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Input, SelectableCard } from '../../../../design-system';
import { semanticColors } from '../../../../design-system/tokens/colors';
import { spacing } from '../../../../design-system/tokens/spacing';
import { typography } from '../../../../design-system/tokens/typography';
import type { LimitFieldValue } from '../../../../types/plan';

export type PlanFormFieldsProps = {
  nombre: string;
  onChangeNombre: (value: string) => void;
  nombreError?: string;

  precio: string;
  onChangePrecio: (value: string) => void;
  precioError?: string;

  limiteCasos: LimitFieldValue;
  onChangeLimiteCasos: (value: LimitFieldValue) => void;
  limiteCasosError?: string;

  limiteCarpetas: LimitFieldValue;
  onChangeLimiteCarpetas: (value: LimitFieldValue) => void;
  limiteCarpetasError?: string;

  limiteIteracionesIa: LimitFieldValue;
  onChangeLimiteIteracionesIa: (value: LimitFieldValue) => void;
  limiteIteracionesIaError?: string;

  disabled?: boolean;
};

/**
 * Shared create/edit fields for the R-10 admin plan ABM. Each limit field
 * is a two-way choice ("ilimitado" vs. "con límite") rather than a raw
 * number input alone — the backend encodes "unlimited" as a sentinel
 * (`limiteCasos: null`, `limiteCarpetas`/`limiteIteracionesIa: -1`; see
 * types/plan.ts), and asking an admin to type `-1` into a plain number
 * field is exactly the kind of implicit-knowledge UI this app's plain-
 * language rule (R-03) exists to avoid.
 */
export function PlanFormFields({
  nombre,
  onChangeNombre,
  nombreError,
  precio,
  onChangePrecio,
  precioError,
  limiteCasos,
  onChangeLimiteCasos,
  limiteCasosError,
  limiteCarpetas,
  onChangeLimiteCarpetas,
  limiteCarpetasError,
  limiteIteracionesIa,
  onChangeLimiteIteracionesIa,
  limiteIteracionesIaError,
  disabled = false,
}: PlanFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.form}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('admin.planes.form.basicInfo.sectionTitle')}</Text>
        <Input
          label={t('admin.planes.form.nombreLabel')}
          placeholder={t('admin.planes.form.nombrePlaceholder')}
          value={nombre}
          onChangeText={onChangeNombre}
          error={nombreError}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label={t('admin.planes.form.precioLabel')}
          hint={t('admin.planes.form.precioHint')}
          placeholder="0.00"
          value={precio}
          onChangeText={onChangePrecio}
          error={precioError}
          editable={!disabled}
          keyboardType="decimal-pad"
        />
      </View>

      <LimitField
        sectionLabel={t('admin.planes.form.limiteCasos.sectionTitle')}
        numberLabel={t('admin.planes.form.limiteCasos.numberLabel')}
        value={limiteCasos}
        onChange={onChangeLimiteCasos}
        error={limiteCasosError}
        disabled={disabled}
      />

      <LimitField
        sectionLabel={t('admin.planes.form.limiteCarpetas.sectionTitle')}
        numberLabel={t('admin.planes.form.limiteCarpetas.numberLabel')}
        value={limiteCarpetas}
        onChange={onChangeLimiteCarpetas}
        error={limiteCarpetasError}
        disabled={disabled}
      />

      <LimitField
        sectionLabel={t('admin.planes.form.limiteIteracionesIa.sectionTitle')}
        numberLabel={t('admin.planes.form.limiteIteracionesIa.numberLabel')}
        value={limiteIteracionesIa}
        onChange={onChangeLimiteIteracionesIa}
        error={limiteIteracionesIaError}
        disabled={disabled}
      />
    </View>
  );
}

type LimitFieldProps = {
  sectionLabel: string;
  numberLabel: string;
  value: LimitFieldValue;
  onChange: (value: LimitFieldValue) => void;
  error?: string;
  disabled: boolean;
};

function LimitField({ sectionLabel, numberLabel, value, onChange, error, disabled }: LimitFieldProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{sectionLabel}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        <SelectableCard
          icon="check"
          title={t('admin.planes.form.unlimitedOption.title')}
          description={t('admin.planes.form.unlimitedOption.description')}
          selected={value.unlimited}
          selectedLabel={t('positions.category.selected')}
          onPress={() => !disabled && onChange({ ...value, unlimited: true })}
        />
        <SelectableCard
          icon="tag"
          title={t('admin.planes.form.limitedOption.title')}
          description={t('admin.planes.form.limitedOption.description')}
          selected={!value.unlimited}
          selectedLabel={t('positions.category.selected')}
          onPress={() => !disabled && onChange({ ...value, unlimited: false })}
        />
      </View>
      {!value.unlimited ? (
        <Input
          label={numberLabel}
          placeholder="0"
          value={value.value}
          onChangeText={(text) => onChange({ ...value, value: text })}
          error={error}
          editable={!disabled}
          keyboardType="number-pad"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  options: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: semanticColors.text.primary,
  },
});
