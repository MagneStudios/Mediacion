import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';

export default function CaseCreateBasicInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setBasicInfo } = useCaseCreationFlow();

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
    router.push('/case/create/method');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: '' }} />
        <CaseCreationProgress step={1} total={4} label={t('caseCreation.progress', { step: 1, total: 4 })} />

        <Text style={styles.title}>{t('caseCreation.basicInfo.title')}</Text>
        <Text style={styles.subtitle}>{t('caseCreation.basicInfo.subtitle')}</Text>

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

        <Button variant="primary" fullWidth onPress={handleContinue}>
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
