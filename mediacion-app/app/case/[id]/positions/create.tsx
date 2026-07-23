import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PositionFormFields } from '@/features/positions/components/PositionFormFields';
import { usePositionDraft } from '@/features/positions/hooks/usePositionDraft';
import type { CategoriaPosicion } from '@/types/position';
import { blurActiveElement } from '@/utils/blur-active-element';
import { validatePositionRange } from '@/utils/validate-position-range';

export default function CreatePositionScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setCategory, setBasicInfo, setRange, setConcession } = usePositionDraft();

  const [category, setLocalCategory] = useState<CategoriaPosicion | null>(draft.category);
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [valueMin, setValueMin] = useState(draft.valueMin);
  const [valueMax, setValueMax] = useState(draft.valueMax);
  const [canConcede, setCanConcede] = useState<boolean | null>(draft.canConcede);
  const [concessionConditions, setConcessionConditions] = useState(draft.concessionConditions);
  const [submitted, setSubmitted] = useState(false);

  const trimmedName = name.trim();
  const nameError = submitted && trimmedName === '' ? t('positions.basicInfo.nameError') : undefined;
  const categoryError = submitted && !category ? t('positions.category.error') : undefined;
  const concedeError = submitted && canConcede === null ? t('positions.concession.error') : undefined;

  const rangeErrors =
    submitted && category
      ? validatePositionRange(category, valueMin, valueMax, {
          required: t('positions.range.requiredError'),
          invalidNumber: t('positions.range.invalidNumberError'),
          minExceedsMax: t('positions.range.minExceedsMaxError'),
        })
      : {};

  const handleContinue = () => {
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

    setCategory(category);
    setBasicInfo(trimmedName, description.trim());
    setRange(valueMin.trim(), valueMax.trim());
    setConcession(canConcede, canConcede ? concessionConditions.trim() : '');
    blurActiveElement();
    router.push({ pathname: '/case/[id]/positions/review', params: { id: caseId } });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: '' }} />

        <Text style={styles.title}>{t('positions.create.title')}</Text>
        <Text style={styles.subtitle}>{t('positions.create.subtitle')}</Text>

        <PositionFormFields
          category={category}
          onSelectCategory={(value) => {
            setLocalCategory(value);
            if (submitted) setSubmitted(false);
          }}
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
        />

        <Button variant="primary" fullWidth onPress={handleContinue}>
          {t('positions.create.continue')}
        </Button>
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
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
  },
  subtitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: semanticColors.text.secondary,
    marginTop: -spacing.sm,
  },
});
