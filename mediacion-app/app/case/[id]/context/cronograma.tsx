import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { ScheduleSectionFields } from '@/features/case-context/components/ScheduleSectionFields';
import { PrivacyNotice } from '@/features/case-context/components/PrivacyNotice';
import { useCaseContextDraft } from '@/features/case-context/hooks/useCaseContextDraft';
import { useSectionSaveQueue } from '@/features/case-context/hooks/useSectionSaveQueue';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';
import type { CaseContextEntry, WeeklyScheduleEntry } from '@/types/case-context';

export default function CronogramaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id as string;
  const { draft } = useCaseContextDraft();
  const { queueSave, flush } = useSectionSaveQueue();
  const { horizontalPadding } = useResponsiveLayout();
  const [saving, setSaving] = useState(false);

  const items = draft?.cronograma ?? [];

  const handleChange = (newItems: CaseContextEntry<WeeklyScheduleEntry>[]) => {
    void queueSave(caseId, 'cronograma', newItems);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await flush();
      blurActiveElement();
      router.back();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('caseContext.sections.cronograma.title')}
        </Text>
        <Text style={styles.subtitle}>{t('caseContext.sections.cronograma.description')}</Text>
      </View>

      <PrivacyNotice />

      <ScheduleSectionFields items={items} onChange={handleChange} />

      <View style={styles.actions}>
        <Button variant="primary" fullWidth onPress={handleConfirm} disabled={saving}>
          {saving ? t('common.loading') : t('common.confirm')}
        </Button>
        <Button variant="tertiary" fullWidth onPress={() => router.back()}>
          {t('common.cancel')}
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
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
  actions: {
    gap: spacing.xs,
  },
});
