import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, SelectableCard } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import type { MetodoCaso } from '@/types/case';
import { blurActiveElement } from '@/utils/blur-active-element';

const METHODS: MetodoCaso[] = ['negociacion', 'conciliacion', 'mediacion'];

export default function CaseCreateMethodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setMetodo } = useCaseCreationFlow();

  const handleContinue = () => {
    if (!draft.metodo) return;
    blurActiveElement();
    router.push('/case/create/review');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '' }} />
      <CaseCreationProgress step={2} total={4} label={t('caseCreation.progress', { step: 2, total: 4 })} />

      <Text style={styles.title} accessibilityRole="header">
        {t('caseCreation.method.title')}
      </Text>
      <Text style={styles.subtitle}>{t('caseCreation.method.subtitle')}</Text>

      {METHODS.map((metodo) => (
        <SelectableCard
          key={metodo}
          icon={metodo === 'mediacion' ? 'scale' : metodo === 'conciliacion' ? 'shield-check' : 'messages-square'}
          title={t(`methods.${metodo}`)}
          description={t(`caseCreation.method.descriptions.${metodo}`)}
          selected={draft.metodo === metodo}
          selectedLabel={t('caseCreation.method.selected')}
          onPress={() => setMetodo(metodo)}
        />
      ))}

      <Button variant="primary" fullWidth disabled={!draft.metodo} onPress={handleContinue}>
        {t('caseCreation.method.continue')}
      </Button>
      <Button
        variant="tertiary"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.back();
        }}
      >
        {t('caseCreation.method.back')}
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
  subtitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: semanticColors.text.secondary,
    marginTop: -spacing.sm,
  },
});
