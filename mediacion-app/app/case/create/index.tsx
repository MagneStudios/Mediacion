import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function CaseCreateBasicInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setBasicInfo } = useCaseCreationFlow();
  const { horizontalPadding } = useResponsiveLayout();

  const [nombre, setNombre] = useState(draft.nombre);
  const [descripcion, setDescripcion] = useState(draft.descripcion);
  const [submitted, setSubmitted] = useState(false);

  const trimmedNombre = nombre.trim();
  const nameError = submitted && trimmedNombre === '' ? t('caseCreation.basicInfo.nameError') : undefined;

  const handleContinue = () => {
    if (trimmedNombre === '') {
      setSubmitted(true);
      return;
    }
    setBasicInfo(trimmedNombre, descripcion.trim());
    blurActiveElement();
    router.push('/case/create/method');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: '' }} />
        <CaseCreationProgress step={1} total={4} label={t('caseCreation.progress', { step: 1, total: 4 })} />

        <View style={styles.intro}>
          <Text style={styles.title} accessibilityRole="header">
            {t('caseCreation.basicInfo.title')}
          </Text>
          <Text style={styles.subtitle}>{t('caseCreation.basicInfo.subtitle')}</Text>
        </View>

        <View style={styles.fields}>
          <Input
            label={t('caseCreation.basicInfo.nameLabel')}
            placeholder={t('caseCreation.basicInfo.namePlaceholder')}
            value={nombre}
            onChangeText={(value) => {
              setNombre(value);
              if (submitted) setSubmitted(false);
            }}
            error={nameError}
            returnKeyType="next"
          />

          <Input
            label={t('caseCreation.basicInfo.descriptionLabel')}
            hint={t('caseCreation.basicInfo.descriptionHint')}
            placeholder={t('caseCreation.basicInfo.descriptionPlaceholder')}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={3}
          />
        </View>

        <Button variant="primary" size="lg" fullWidth onPress={handleContinue}>
          {t('caseCreation.basicInfo.continue')}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  intro: {
    gap: spacing.xs,
  },
  fields: {
    gap: spacing.lg,
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
