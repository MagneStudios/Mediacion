import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, StatusPill } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';

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
    router.dismissTo('/(tabs)');
    if (caseId) {
      router.push({ pathname: '/case/[id]', params: { id: caseId } });
    }
  };

  const handleBackToDashboard = () => {
    reset();
    router.dismissTo('/(tabs)');
  };

  return (
    <View style={styles.container}>
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

      <Text style={styles.title}>{t('caseCreation.success.title')}</Text>
      <Text style={styles.body}>{t('caseCreation.success.body')}</Text>

      <StatusPill status="info">{t('caseCreation.success.status')}</StatusPill>

      {invitationTipoLabel ? (
        <Text style={styles.method}>{invitationTipoLabel}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button variant="primary" fullWidth onPress={handleViewCase}>
          {t('caseCreation.success.viewCase')}
        </Button>
        <Button variant="secondary" fullWidth onPress={handleBackToDashboard}>
          {t('caseCreation.success.backToDashboard')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: semanticColors.status.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: semanticColors.text.secondary,
    textAlign: 'center',
  },
  method: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    color: semanticColors.text.tertiary,
  },
  actions: {
    width: '100%',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
