import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { DemoEnvironmentNotice } from '@/features/profile/components/DemoEnvironmentNotice';
import { HelpTopicCard } from '@/features/profile/components/HelpTopicCard';

const TOPIC_KEYS = ['flow', 'privacy', 'afterAgreement', 'signatureSimulation', 'mediator'] as const;

export default function ProfileHelpScreen() {
  const { t } = useTranslation();
  const [showContactNotice, setShowContactNotice] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('profile.help.title') }} />

      {TOPIC_KEYS.map((key) => (
        <HelpTopicCard
          key={key}
          question={t(`profile.help.topics.${key}.question`)}
          answer={t(`profile.help.topics.${key}.answer`)}
        />
      ))}

      <Button variant="secondary" fullWidth onPress={() => setShowContactNotice(true)}>
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
    padding: spacing.md,
    gap: spacing.sm,
  },
});
