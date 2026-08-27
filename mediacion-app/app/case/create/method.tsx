import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, SelectableCard } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { metodosEnOrden } from '@/types/case';
import { blurActiveElement } from '@/utils/blur-active-element';
import { getMethodIcon } from '@/utils/get-method-icon';

export default function CaseCreateMethodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setMetodo } = useCaseCreationFlow();
  const { horizontalPadding } = useResponsiveLayout();

  const handleContinue = () => {
    if (!draft.metodo) return;
    blurActiveElement();
    router.push('/case/create/review');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: '' }} />
      <CaseCreationProgress step={2} total={4} label={t('caseCreation.progress', { step: 2, total: 4 })} />

      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          {t('caseCreation.method.title')}
        </Text>
        <Text style={styles.subtitle}>{t('caseCreation.method.subtitle')}</Text>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {metodosEnOrden.map((metodo) => (
          <SelectableCard
            key={metodo}
            icon={getMethodIcon(metodo)}
            title={t(`methods.${metodo}`)}
            description={t(`caseCreation.method.descriptions.${metodo}`)}
            selected={draft.metodo === metodo}
            selectedLabel={t('caseCreation.method.selected')}
            onPress={() => setMetodo(metodo)}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button variant="primary" size="lg" fullWidth disabled={!draft.metodo} onPress={handleContinue}>
          {t('caseCreation.method.continue')}
        </Button>
        <Button
          variant="tertiary"
          size="lg"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.back();
          }}
        >
          {t('caseCreation.method.back')}
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
  intro: {
    gap: spacing.xs,
  },
  options: {
    gap: spacing.sm,
  },
  actions: {
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
});
