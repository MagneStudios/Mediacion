import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PlanFormFields } from '@/features/admin/planes/components/PlanFormFields';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { plansService } from '@/services/plans.service';
import type { LimitFieldValue, Plan } from '@/types/plan';
import { blurActiveElement } from '@/utils/blur-active-element';
import { hasPlanFormErrors, toPlanInput, validatePlanForm } from '@/utils/validate-plan-form';

type FetchStatus = 'loading' | 'error' | 'success';
type SaveStatus = 'idle' | 'submitting' | 'error';

/** `-1` and `null` both read as "unlimited" here — see types/plan.ts for why the two sentinels coexist. */
function toLimitField(value: number | null): LimitFieldValue {
  if (value === null || value === -1) {
    return { unlimited: true, value: '' };
  }
  return { unlimited: false, value: String(value) };
}

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading');
  const [plan, setPlan] = useState<Plan | null>(null);

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [limiteCasos, setLimiteCasos] = useState<LimitFieldValue>({ unlimited: true, value: '' });
  const [limiteCarpetas, setLimiteCarpetas] = useState<LimitFieldValue>({ unlimited: true, value: '' });
  const [limiteIteracionesIa, setLimiteIteracionesIa] = useState<LimitFieldValue>({ unlimited: true, value: '' });
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setFetchStatus('loading');
    plansService
      .getPlan(id)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setFetchStatus('error');
          return;
        }
        setPlan(result);
        setNombre(result.nombre);
        setPrecio(String(result.precio));
        setLimiteCasos(toLimitField(result.limiteCasos));
        setLimiteCarpetas(toLimitField(result.limiteCarpetas));
        setLimiteIteracionesIa(toLimitField(result.limiteIteracionesIa));
        setFetchStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setFetchStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (fetchStatus === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (fetchStatus === 'error' || !plan) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState
          title={t('admin.planes.edit.notFound.title')}
          retryLabel={t('common.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </View>
    );
  }

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
      await plansService.updatePlan(plan.id, toPlanInput(nombre, precio, limiteCasos, limiteCarpetas, limiteIteracionesIa));
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
        <Stack.Screen options={{ title: t('admin.planes.edit.title') }} />

        <Text style={styles.title} accessibilityRole="header">
          {t('admin.planes.edit.title')}
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
            {t('admin.planes.edit.save')}
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
