import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { HelpTopicCard } from '@/features/profile/components/HelpTopicCard';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

const TOPIC_KEYS = ['flow', 'privacy', 'afterAgreement', 'signatureSimulation', 'mediator'] as const;

export default function ProfileHelpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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

      {/*
        Used to open a "there is no contact channel yet" demo notice. There
        is one now (instructivo §5, punto #23), so this goes to the real
        form instead of telling the user their message goes nowhere.
      */}
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push('/contacto');
        }}
      >
        {t('profile.help.contact.action')}
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
