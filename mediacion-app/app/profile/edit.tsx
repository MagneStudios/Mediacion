import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Input, LoadingState } from '@/design-system';
import { SelectableCard } from '@/design-system/components/SelectableCard';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { LanguageSelector } from '@/features/profile/components/LanguageSelector';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { AccessibilityPreference, CommunicationPreference, PreferredLanguage } from '@/types/profile';

type Draft = {
  nombre: string;
  apellido: string;
  idioma: PreferredLanguage;
  communicationPreference: CommunicationPreference;
  accessibilityPreference: AccessibilityPreference;
};

export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const { status, profile, reload, updateStatus, updateProfile, resetUpdateStatus } = useProfile();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  // Seed the draft only once, from the first successful load — a later
  // silent focus-refresh must never overwrite an in-progress edit.
  const seededRef = useRef(false);

  useEffect(() => {
    if (profile && !seededRef.current) {
      setDraft({
        nombre: profile.nombre,
        apellido: profile.apellido,
        idioma: profile.idioma,
        communicationPreference: profile.communicationPreference,
        accessibilityPreference: profile.accessibilityPreference,
      });
      seededRef.current = true;
    }
  }, [profile]);

  if (status === 'error') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('profile.edit.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </ScrollView>
    );
  }

  if (status === 'loading' || !draft) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('profile.edit.title') }} />
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  if (!profile) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('profile.edit.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </ScrollView>
    );
  }

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setSavedOnce(false);
    if (updateStatus === 'error') resetUpdateStatus();
  };

  const handleSave = async () => {
    await updateProfile(draft);
    setSavedOnce(true);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.edit.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('profile.edit.title')}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.edit.nameSection')}</Text>
        <Input label={t('profile.edit.firstNameLabel')} value={draft.nombre} onChangeText={(value) => updateDraft({ nombre: value })} />
        <Input label={t('profile.edit.lastNameLabel')} value={draft.apellido} onChangeText={(value) => updateDraft({ apellido: value })} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.edit.languageSection')}</Text>
        <LanguageSelector
          value={draft.idioma}
          onChange={(next) => updateDraft({ idioma: next })}
          esLabel={t('profile.edit.languageEs')}
          esDescription={t('profile.edit.languageEsDescription')}
          enLabel={t('profile.edit.languageEn')}
          enDescription={t('profile.edit.languageEnDescription')}
          selectedLabel={t('profile.edit.selectedLabel')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.edit.communicationSection')}</Text>
        <SelectableCard
          icon="messages-square"
          title={t('profile.edit.communicationEmail')}
          description={t('profile.edit.communicationEmailDescription')}
          selected={draft.communicationPreference === 'email_summary'}
          selectedLabel={t('profile.edit.selectedLabel')}
          onPress={() => updateDraft({ communicationPreference: 'email_summary' })}
        />
        <SelectableCard
          icon="inbox"
          title={t('profile.edit.communicationInApp')}
          description={t('profile.edit.communicationInAppDescription')}
          selected={draft.communicationPreference === 'in_app_only'}
          selectedLabel={t('profile.edit.selectedLabel')}
          onPress={() => updateDraft({ communicationPreference: 'in_app_only' })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.edit.accessibilitySection')}</Text>
        <SelectableCard
          icon="user"
          title={t('profile.edit.accessibilitySystem')}
          description={t('profile.edit.accessibilitySystemDescription')}
          selected={draft.accessibilityPreference === 'system_default'}
          selectedLabel={t('profile.edit.selectedLabel')}
          onPress={() => updateDraft({ accessibilityPreference: 'system_default' })}
        />
        <SelectableCard
          icon="user"
          title={t('profile.edit.accessibilityLargerText')}
          description={t('profile.edit.accessibilityLargerTextDescription')}
          selected={draft.accessibilityPreference === 'larger_text_preference'}
          selectedLabel={t('profile.edit.selectedLabel')}
          onPress={() => updateDraft({ accessibilityPreference: 'larger_text_preference' })}
        />
      </View>

      <View style={styles.actions}>
        {updateStatus === 'error' ? (
          <ErrorState title={t('profile.edit.error.title')} retryLabel={t('profile.edit.error.retry')} onRetry={handleSave} />
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSave}
            loading={updateStatus === 'pending'}
            loadingLabel={t('common.loading')}
            accessibilityLabel={t('profile.edit.save')}
          >
            {t('profile.edit.save')}
          </Button>
        )}
        {savedOnce && updateStatus === 'idle' ? <Text style={styles.savedText}>{t('profile.edit.saved')}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  loadingContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  titleWide: {
    ...typography.displayLg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.eyebrow,
    color: semanticColors.text.tertiary,
  },
  actions: {
    gap: spacing.sm,
  },
  savedText: {
    textAlign: 'center',
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
