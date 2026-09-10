import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon } from '@/design-system';
import { colors, semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { fontFamily, typography } from '@/design-system/tokens/typography';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

/**
 * Shown right after joining a case when this party still needs their own
 * active subscription to operate on it — the gate is C-01 ("cada parte
 * paga la suya"), not whoever invited whom. Mirrors the backend's planned
 * gate on `POST /casos/unirse` (`docs/plan-implementacion-07-08-2026.md`,
 * Fase 3) on the frontend side.
 *
 * Punto #6 (AJUSTES-PACTUM-2026-09-10): hasta acá el copy y el campo
 * `requiresPayment` estaban atados a `pagoACargo` (quién de las dos partes
 * "elegía" pagar). Ese selector se sacó de la UI de invitar
 * (`app/case/create/invite.tsx`) — el modelo real es suscripción individual
 * por parte, sin importar quién invitó. `requiresPayment` como señal de
 * "a esta parte le falta suscripción" sigue siendo válida sin cambios de
 * backend; lo que cambió es que ya no se presenta como una decisión ajena.
 *
 * No real enforcement exists anywhere in this mock — `casesService.joinCase`
 * already transitioned the case and returned `requiresPayment`, there's no
 * second check this screen could perform. So, like `SimulateInvitationAcceptanceDialog`
 * elsewhere in this app, it offers an explicit, clearly-labeled demo bypass
 * rather than pretending to block access it cannot actually enforce.
 */
export default function PaymentRequiredScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fontFamily.semibold },
          headerShadowVisible: false,
        }}
      />

      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name="wallet" size={22} color={semanticColors.ai.accent} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('billing.paymentRequired.title')}
        </Text>
        <Text style={styles.body}>{t('billing.paymentRequired.body')}</Text>
      </Card>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push('/profile/plan');
        }}
      >
        {t('billing.paymentRequired.viewPlansAction')}
      </Button>

      <View style={styles.demoSection}>
        <Text style={styles.demoText}>{t('billing.paymentRequired.demoBypass.description')}</Text>
        <Button
          variant="tertiary"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.replace({ pathname: '/case/[id]', params: { id: caseId } });
          }}
        >
          {t('billing.paymentRequired.demoBypass.action')}
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
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.supportAqua,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.cardTitle,
    fontSize: 20,
    color: semanticColors.text.primary,
  },
  body: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  demoSection: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
    alignItems: 'center',
  },
  demoText: {
    ...typography.bodySm,
    color: semanticColors.text.tertiary,
    textAlign: 'center',
  },
});
