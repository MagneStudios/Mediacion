import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { CaseReviewCard } from '@/features/cases/components/CaseReviewCard';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { casesService } from '@/services/cases.service';
import { blurActiveElement } from '@/utils/blur-active-element';

type CreateStatus = 'idle' | 'submitting' | 'error';

export default function CaseCreateReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setCreatedCase } = useCaseCreationFlow();
  const [status, setStatus] = useState<CreateStatus>('idle');
  const { horizontalPadding } = useResponsiveLayout();

  const handleCreate = async () => {
    if (status === 'submitting' || !draft.metodo) return;
    setStatus('submitting');
    try {
      const created = await casesService.createCase({
        nombre: draft.nombre,
        descripcion: draft.descripcion || undefined,
        metodo: draft.metodo,
      });
      setCreatedCase(created.id);
      setStatus('idle');
      blurActiveElement();
      router.push('/case/create/invite');
    } catch {
      setStatus('error');
    }
  };

  if (!draft.metodo) {
    // Defensive fallback — the wizard is push-only in order, so this only
    // triggers if a step was skipped some other way.
    return (
      <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
        <Stack.Screen options={{ title: '' }} />
        <ErrorState
          title={t('caseCreation.review.error.title')}
          retryLabel={t('caseCreation.method.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: '' }} />
      <CaseCreationProgress step={3} total={4} label={t('caseCreation.progress', { step: 3, total: 4 })} />

      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          {t('caseCreation.review.title')}
        </Text>
      </View>

      <CaseReviewCard
        nameLabel={t('caseCreation.review.nameLabel')}
        name={draft.nombre}
        descriptionLabel={t('caseCreation.review.descriptionLabel')}
        description={draft.descripcion || undefined}
        methodLabel={t('caseCreation.review.methodLabel')}
        method={t(`methods.${draft.metodo}`)}
      />

      <PrivacyNotice>{t('caseCreation.review.privacyReminder')}</PrivacyNotice>

      <View style={styles.actions}>
        {status === 'error' ? (
          <ErrorState
            title={t('caseCreation.review.error.title')}
            retryLabel={t('caseCreation.review.error.retry')}
            onRetry={handleCreate}
          />
        ) : (
          <Button variant="primary" size="lg" fullWidth onPress={handleCreate} loading={status === 'submitting'} loadingLabel={t('caseCreation.review.creating')}>
            {t('caseCreation.review.create')}
          </Button>
        )}
        <Button
          variant="tertiary"
          size="lg"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.back();
          }}
          disabled={status === 'submitting'}
        >
          {t('caseCreation.review.edit')}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  intro: {
    marginBottom: spacing.xs,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
});
