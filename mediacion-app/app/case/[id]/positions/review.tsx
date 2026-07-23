import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { PositionReviewCard } from '@/features/positions/components/PositionReviewCard';
import { usePositionDraft } from '@/features/positions/hooks/usePositionDraft';
import { positionsService } from '@/services/positions.service';
import { blurActiveElement } from '@/utils/blur-active-element';

type SaveStatus = 'idle' | 'submitting' | 'error';

export default function ReviewPositionScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, reset } = usePositionDraft();
  const [status, setStatus] = useState<SaveStatus>('idle');

  if (!draft.category || draft.canConcede === null) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState
          title={t('positions.review.error.title')}
          retryLabel={t('caseCreation.method.back')}
          onRetry={() => router.back()}
        />
      </ScrollView>
    );
  }

  const handleSave = async () => {
    if (status === 'submitting') return;
    setStatus('submitting');
    try {
      await positionsService.createOwnPosition({
        caseId,
        category: draft.category!,
        name: draft.name,
        description: draft.description || undefined,
        valueMin: draft.valueMin,
        valueMax: draft.valueMax,
        canConcede: draft.canConcede!,
        concessionConditions: draft.canConcede ? draft.concessionConditions || undefined : undefined,
      });
      reset();
      blurActiveElement();
      router.dismissTo({ pathname: '/case/[id]/positions', params: { id: caseId } });
    } catch {
      setStatus('error');
    }
  };

  const rows = [
    { label: t('positions.review.categoryLabel'), value: t(`positions.category.${draft.category}.label`) },
    { label: t('positions.review.nameLabel'), value: draft.name },
    ...(draft.description
      ? [{ label: t('positions.review.descriptionLabel'), value: draft.description }]
      : []),
    { label: t('positions.review.rangeLabel'), value: t('positions.review.rangeValue', { min: draft.valueMin, max: draft.valueMax }) },
    {
      label: t('positions.review.concessionLabel'),
      value: draft.canConcede ? t('positions.concession.canConcedeTitle') : t('positions.concession.cannotConcedeTitle'),
    },
    ...(draft.canConcede && draft.concessionConditions
      ? [{ label: t('positions.review.conditionsLabel'), value: draft.concessionConditions }]
      : []),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '' }} />

      <Text style={styles.title}>{t('positions.review.title')}</Text>

      <PositionReviewCard rows={rows} />

      <PrivacyNotice title={t('positions.review.privacyTitle')}>{t('positions.review.privacyBody')}</PrivacyNotice>

      {status === 'error' ? (
        <ErrorState
          title={t('positions.review.saveError.title')}
          retryLabel={t('positions.review.saveError.retry')}
          onRetry={handleSave}
        />
      ) : (
        <Button variant="primary" fullWidth onPress={handleSave} disabled={status === 'submitting'}>
          {status === 'submitting' ? t('positions.review.saving') : t('positions.review.save')}
        </Button>
      )}
      <Button variant="tertiary" fullWidth onPress={() => router.back()} disabled={status === 'submitting'}>
        {t('positions.review.edit')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
