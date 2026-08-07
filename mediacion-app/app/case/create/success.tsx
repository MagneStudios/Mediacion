import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, ScreenContainer, StatusPill } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function CaseCreateSuccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, reset } = useCaseCreationFlow();

  const caseId = draft.caseId;
  const invitationTipoLabel = draft.invitation
    ? t(`caseCreation.invite.method.${draft.invitation.tipo}.title`)
    : undefined;

  const handleViewCase = () => {
    reset();
    blurActiveElement();
    if (caseId) {
      router.replace({ pathname: '/case/[id]', params: { id: caseId } });
    } else {
      router.dismissTo('/(tabs)');
    }
  };

  const handleBackToDashboard = () => {
    reset();
    blurActiveElement();
    router.dismissTo('/(tabs)');
  };

  return (
    <ScreenContainer widthToken="form" centerVertically style={styles.content}>
      <Stack.Screen
        options={{
          title: '',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      <View style={styles.badge}>
        <Icon name="check" size={30} color={semanticColors.status.successFg} />
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {t('caseCreation.success.title')}
      </Text>
      <Text style={styles.body}>{t('caseCreation.success.body')}</Text>

      <StatusPill status="info">{t('caseCreation.success.status')}</StatusPill>

      {invitationTipoLabel ? (
        <Text style={styles.method}>{invitationTipoLabel}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button variant="primary" size="lg" fullWidth onPress={handleViewCase}>
          {t('caseCreation.success.viewCase')}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onPress={handleBackToDashboard}>
          {t('caseCreation.success.backToDashboard')}
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.status.successBg,
    borderWidth: 1,
    borderColor: semanticColors.status.successFg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: semanticColors.text.secondary,
    textAlign: 'center',
    maxWidth: 520,
  },
  method: {
    ...typography.bodySm,
    color: semanticColors.text.tertiary,
    marginTop: -spacing.xs,
  },
  actions: {
    width: '100%',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
