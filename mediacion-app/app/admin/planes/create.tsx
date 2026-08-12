import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PlanFormFields } from '@/features/admin/planes/components/PlanFormFields';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { plansService } from '@/services/plans.service';
import type { LimitFieldValue } from '@/types/plan';
import { blurActiveElement } from '@/utils/blur-active-element';
import { hasPlanFormErrors, toPlanInput, validatePlanForm } from '@/utils/validate-plan-form';

type SaveStatus = 'idle' | 'submitting' | 'error';

const unlimitedField = (): LimitFieldValue => ({ unlimited: true, value: '' });

export default function CreatePlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [limiteCasos, setLimiteCasos] = useState<LimitFieldValue>(unlimitedField());
  const [limiteCarpetas, setLimiteCarpetas] = useState<LimitFieldValue>(unlimitedField());
  const [limiteIteracionesIa, setLimiteIteracionesIa] = useState<LimitFieldValue>(unlimitedField());
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const messages = {
    nombreRequired: t('admin.planes.form.nombreError'),
    precioRequired: t('admin.planes.form.precioRequiredError'),
    precioInvalid: t('admin.planes.form.precioInvalidError'),
    limitRequired: t('admin.planes.form.limitRequiredError'),
    limitInvalid: t('admin.planes.form.limitInvalidError'),
    limitNegative: t('admin.planes.form.limitNegativeError'),
  };

  const errors = submitted
    ? validatePlanForm(nombre, precio, limiteCasos, limiteCarpetas, limiteIteracionesIa, messages)
    : {};

  const handleSave = async () => {
    if (saveStatus === 'submitting') return;
    const validation = validatePlanForm(nombre, precio, limiteCasos, limiteCarpetas, limiteIteracionesIa, messages);
    if (hasPlanFormErrors(validation)) {
      setSubmitted(true);
      return;
    }

    setSaveStatus('submitting');
    setSubmitError(undefined);
    try {
      await plansService.createPlan(toPlanInput(nombre, precio, limiteCasos, limiteCarpetas, limiteIteracionesIa));
      blurActiveElement();
      router.back();
    } catch (error) {
      setSaveStatus('error');
      setSubmitError(
        error instanceof Error && error.message === 'plan_nombre_taken'
          ? t('admin.planes.form.nombreTakenError')
          : undefined,
      );
    }
  };

  const clearSubmittedOnChange = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    if (submitted) setSubmitted(false);
    if (saveStatus === 'error') setSaveStatus('idle');
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: t('admin.planes.create.title') }} />

        <Text style={styles.title} accessibilityRole="header">
          {t('admin.planes.create.title')}
        </Text>

        <PlanFormFields
          nombre={nombre}
          onChangeNombre={clearSubmittedOnChange(setNombre)}
          nombreError={errors.nombreError}
          precio={precio}
          onChangePrecio={clearSubmittedOnChange(setPrecio)}
          precioError={errors.precioError}
          limiteCasos={limiteCasos}
          onChangeLimiteCasos={clearSubmittedOnChange(setLimiteCasos)}
          limiteCasosError={errors.limiteCasosError}
          limiteCarpetas={limiteCarpetas}
          onChangeLimiteCarpetas={clearSubmittedOnChange(setLimiteCarpetas)}
          limiteCarpetasError={errors.limiteCarpetasError}
          limiteIteracionesIa={limiteIteracionesIa}
          onChangeLimiteIteracionesIa={clearSubmittedOnChange(setLimiteIteracionesIa)}
          limiteIteracionesIaError={errors.limiteIteracionesIaError}
        />

        {saveStatus === 'error' ? (
          <ErrorState
            title={submitError ?? t('admin.planes.form.saveError.title')}
            retryLabel={t('common.retry')}
            onRetry={handleSave}
          />
        ) : (
          <Button variant="primary" size="lg" fullWidth onPress={handleSave} loading={saveStatus === 'submitting'} loadingLabel={t('common.loading')}>
            {t('admin.planes.create.save')}
          </Button>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
});
