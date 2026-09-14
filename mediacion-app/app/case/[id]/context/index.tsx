import { Stack, useLocalSearchParams, useRouter, type RelativePathString } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Icon } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseContextProgress } from '@/features/case-context/components/CaseContextProgress';
import { useCaseContext } from '@/features/case-context/hooks/useCaseContextDraft';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';
import type { CaseContextSectionId } from '@/types/case-context';

const ALL_SECTIONS: CaseContextSectionId[] = [
  'integrantes',
  'actividades',
  'colegio',
  'cronograma',
  'domicilios',
  'restricciones',
];

export default function CaseContextIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id as string;
  const { draft } = useCaseContext(caseId);
  const { horizontalPadding } = useResponsiveLayout();

  const completedCount = draft?.completedSections.length ?? 0;

  const goToSection = (sectionId: CaseContextSectionId) => {
    blurActiveElement();
    router.push({ pathname: `/case/[id]/context/${sectionId}` as RelativePathString, params: { id: caseId } });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('caseContext.title')}
        </Text>
        <Text style={styles.subtitle}>{t('caseContext.subtitle')}</Text>
      </View>

      <CaseContextProgress completed={completedCount} total={ALL_SECTIONS.length} />

      <View style={styles.sections}>
        {ALL_SECTIONS.map((sectionId) => {
          const isCompleted = draft?.completedSections.includes(sectionId) ?? false;
          return (
            <Card key={sectionId} style={styles.sectionCard} interactive onPress={() => goToSection(sectionId)}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionIconWrap}>
                  <Icon
                    name={isCompleted ? 'check' : 'pencil'}
                    size={18}
                    color={isCompleted ? semanticColors.status.successFg : semanticColors.text.tertiary}
                  />
                </View>
                <View style={styles.sectionInfo}>
                  <Text style={styles.sectionTitle}>{t(`caseContext.sections.${sectionId}.title`)}</Text>
                  <Text style={styles.sectionDescription}>
                    {t(`caseContext.sections.${sectionId}.description`)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={semanticColors.text.tertiary} />
              </View>
            </Card>
          );
        })}
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
  sections: {
    gap: spacing.sm,
  },
  sectionCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  sectionTitle: {
    ...typography.bodySm,
    color: semanticColors.text.primary,
    fontWeight: '600',
  },
  sectionDescription: {
    ...typography.caption,
    color: semanticColors.text.secondary,
  },
});
