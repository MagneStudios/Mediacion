import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { DemoEnvironmentNotice } from '@/features/profile/components/DemoEnvironmentNotice';
import { HelpTopicCard } from '@/features/profile/components/HelpTopicCard';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const TOPIC_KEYS = ['flow', 'privacy', 'afterAgreement', 'signatureSimulation', 'mediator'] as const;

export default function ProfileHelpScreen() {
  const { t } = useTranslation();
  const [showContactNotice, setShowContactNotice] = useState(false);
  const { horizontalPadding, isWide } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.help.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('profile.help.title')}
      </Text>

      {TOPIC_KEYS.map((key) => (
        <HelpTopicCard
          key={key}
          question={t(`profile.help.topics.${key}.question`)}
          answer={t(`profile.help.topics.${key}.answer`)}
        />
      ))}

      <Button variant="secondary" size="lg" fullWidth onPress={() => setShowContactNotice(true)}>
        {t('profile.help.contact.action')}
      </Button>
      {showContactNotice ? (
        <DemoEnvironmentNotice title={t('profile.demoNotice.title')} body={t('profile.help.contact.notice')} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
    marginBottom: spacing.xs,
  },
  titleWide: {
    ...typography.displayLg,
  },
});
