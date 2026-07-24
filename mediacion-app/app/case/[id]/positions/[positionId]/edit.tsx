import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useCaseDetail } from '@/features/cases/hooks/useCaseDetail';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { PositionFormFields } from '@/features/positions/components/PositionFormFields';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { positionsService } from '@/services/positions.service';
import type { CategoriaPosicion, PositionItem } from '@/types/position';
import { blurActiveElement } from '@/utils/blur-active-element';
import { getPositionEligibility } from '@/utils/position-eligibility';
import { validatePositionRange } from '@/utils/validate-position-range';

type FetchStatus = 'loading' | 'error' | 'success';
type SaveStatus = 'idle' | 'submitting' | 'error';

export default function EditPositionScreen() {
  const { id: caseId, positionId } = useLocalSearchParams<{ id: string; positionId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  const { status: caseStatus, detail } = useCaseDetail(caseId);

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading');
  const [item, setItem] = useState<PositionItem | null>(null);

  const [category, setCategory] = useState<CategoriaPosicion | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [valueMin, setValueMin] = useState('');
  const [valueMax, setValueMax] = useState('');
  const [canConcede, setCanConcede] = useState<boolean | null>(null);
  const [concessionConditions, setConcessionConditions] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setFetchStatus('loading');
    positionsService
      .getOwnPosition(caseId, positionId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setFetchStatus('error');
          return;
        }
        setItem(result);
        setCategory(result.category);
        setName(result.name);
        setDescription(result.description ?? '');
        setValueMin(result.valueMin);
        setValueMax(result.valueMax);
        setCanConcede(result.canConcede);
        setConcessionConditions(result.concessionConditions ?? '');
        setFetchStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setFetchStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, positionId]);

  if (caseStatus === 'loading' || fetchStatus === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (caseStatus === 'error' || fetchStatus === 'error' || !detail || !item) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState
          title={t('positions.edit.notFound.title')}
          retryLabel={t('common.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </View>
    );
  }

  const eligibility = getPositionEligibility(detail.estado);
  const readOnly = eligibility !== 'editable';

  const rangeErrors =
    submitted && category
      ? validatePositionRange(category, valueMin, valueMax, {
          required: t('positions.range.requiredError'),
          invalidNumber: t('positions.range.invalidNumberError'),
          minExceedsMax: t('positions.range.minExceedsMaxError'),
        })
      : {};

  const trimmedName = name.trim();
  const nameError = submitted && trimmedName === '' ? t('positions.basicInfo.nameError') : undefined;
  const categoryError = submitted && !category ? t('positions.category.error') : undefined;
  const concedeError = submitted && canConcede === null ? t('positions.concession.error') : undefined;

  const handleSave = async () => {
    if (saveStatus === 'submitting' || readOnly) return;
    if (!category || trimmedName === '' || canConcede === null) {
      setSubmitted(true);
      return;
    }
    const errors = validatePositionRange(category, valueMin, valueMax, {
      required: t('positions.range.requiredError'),
      invalidNumber: t('positions.range.invalidNumberError'),
      minExceedsMax: t('positions.range.minExceedsMaxError'),
    });
    if (errors.minError || errors.maxError) {
      setSubmitted(true);
      return;
    }

    setSaveStatus('submitting');
    try {
      await positionsService.updateOwnPosition({
        id: item.id,
        caseId,
        category,
        name: trimmedName,
        description: description.trim() || undefined,
        valueMin: valueMin.trim(),
        valueMax: valueMax.trim(),
        canConcede,
        concessionConditions: canConcede ? concessionConditions.trim() || undefined : undefined,
      });
      blurActiveElement();
      router.back();
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: '' }} />

        <Text style={styles.title} accessibilityRole="header">
          {readOnly ? t('positions.edit.readOnlyTitle') : t('positions.edit.title')}
        </Text>

        {readOnly ? (
          <Badge variant="neutral">{t('positions.edit.readOnlyBadge')}</Badge>
        ) : null}

        <PrivacyNotice>{t('positions.dashboard.supportingCopy')}</PrivacyNotice>

        <PositionFormFields
          category={category}
          onSelectCategory={setCategory}
          categoryError={categoryError}
          name={name}
          onChangeName={(value) => {
            setName(value);
            if (submitted) setSubmitted(false);
          }}
          nameError={nameError}
          description={description}
          onChangeDescription={setDescription}
          valueMin={valueMin}
          onChangeMin={(value) => {
            setValueMin(value);
            if (submitted) setSubmitted(false);
          }}
          valueMax={valueMax}
          onChangeMax={(value) => {
            setValueMax(value);
            if (submitted) setSubmitted(false);
          }}
          minError={rangeErrors.minError}
          maxError={rangeErrors.maxError}
          canConcede={canConcede}
          onSelectConcede={(value) => {
            setCanConcede(value);
            if (submitted) setSubmitted(false);
          }}
          concedeError={concedeError}
          concessionConditions={concessionConditions}
          onChangeConditions={setConcessionConditions}
          disabled={readOnly}
        />

        {!readOnly ? (
          saveStatus === 'error' ? (
            <ErrorState
              title={t('positions.edit.saveError.title')}
              retryLabel={t('positions.review.saveError.retry')}
              onRetry={handleSave}
            />
          ) : (
            <Button variant="primary" fullWidth onPress={handleSave} disabled={saveStatus === 'submitting'}>
              {saveStatus === 'submitting' ? t('positions.review.saving') : t('positions.edit.save')}
            </Button>
          )
        ) : null}
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
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
  },
});
