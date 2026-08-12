import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Input, SelectableCard } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { InvitationResultCard } from '@/features/cases/components/InvitationResultCard';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { casesService } from '@/services/cases.service';
import type { PagoACargo, TipoInvitacion } from '@/types/case';
import { blurActiveElement } from '@/utils/blur-active-element';
import { isValidEmail } from '@/utils/validate-email';

const TIPOS: TipoInvitacion[] = ['link', 'codigo', 'email'];
const PAGO_A_CARGO_OPTIONS: PagoACargo[] = ['invitador', 'invitado'];

type InviteStatus = 'idle' | 'submitting' | 'error';

export default function CaseCreateInviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setInvitationResult } = useCaseCreationFlow();
  const { horizontalPadding } = useResponsiveLayout();

  const [tipo, setTipo] = useState<TipoInvitacion | null>(null);
  const [pagoACargo, setPagoACargo] = useState<PagoACargo | null>(null);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState<InviteStatus>('idle');

  const emailError = emailTouched && tipo === 'email' && !isValidEmail(email) ? t('caseCreation.invite.emailError') : undefined;

  const handlePrepare = async () => {
    if (status === 'submitting' || !tipo || !pagoACargo || !draft.caseId) return;

    if (tipo === 'email') {
      setEmailTouched(true);
      if (!isValidEmail(email)) return;
    }

    setStatus('submitting');
    try {
      const invitation = await casesService.createInvitation({
        casoId: draft.caseId,
        tipo,
        emailDestino: tipo === 'email' ? email.trim() : undefined,
        pagoACargo,
      });
      setInvitationResult(invitation);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  if (!draft.caseId) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
      >
        <Stack.Screen options={{ title: '' }} />
        <ErrorState
          title={t('caseCreation.review.error.title')}
          retryLabel={t('caseCreation.method.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: '' }} />
        <CaseCreationProgress step={4} total={4} label={t('caseCreation.progress', { step: 4, total: 4 })} />

        <View style={styles.intro}>
          <Text style={styles.title} accessibilityRole="header">
            {t('caseCreation.invite.title')}
          </Text>
          <Text style={styles.subtitle}>{t('caseCreation.invite.subtitle')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('caseCreation.invite.pagoACargo.sectionTitle')}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {PAGO_A_CARGO_OPTIONS.map((option) => (
              <SelectableCard
                key={option}
                icon={option === 'invitador' ? 'wallet' : 'send'}
                title={t(`caseCreation.invite.pagoACargo.${option}.title`)}
                description={t(`caseCreation.invite.pagoACargo.${option}.description`)}
                selected={pagoACargo === option}
                selectedLabel={t('caseCreation.method.selected')}
                onPress={() => setPagoACargo(option)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('caseCreation.invite.method.sectionTitle')}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {TIPOS.map((option) => (
              <SelectableCard
                key={option}
                icon={option === 'link' ? 'send' : option === 'codigo' ? 'lock' : 'messages-square'}
                title={t(`caseCreation.invite.method.${option}.title`)}
                description={t(`caseCreation.invite.method.${option}.description`)}
                selected={tipo === option}
                selectedLabel={t('caseCreation.method.selected')}
                onPress={() => {
                  setTipo(option);
                  setEmailTouched(false);
                }}
              />
            ))}
          </View>
        </View>

        {tipo === 'email' ? (
          <Input
            label={t('caseCreation.invite.emailLabel')}
            placeholder={t('caseCreation.invite.emailPlaceholder')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}

        {draft.invitation ? (
          <View style={styles.result}>
            <InvitationResultCard
              label={
                draft.invitation.tipo === 'link'
                  ? t('caseCreation.invite.linkLabel')
                  : draft.invitation.tipo === 'codigo'
                    ? t('caseCreation.invite.codeLabel')
                    : t('caseCreation.invite.emailLabel')
              }
              value={draft.invitation.token ?? draft.invitation.emailDestino ?? ''}
              monospace={draft.invitation.tipo === 'codigo'}
              copyLabel={draft.invitation.tipo !== 'email' ? t(`caseCreation.invite.copy.${draft.invitation.tipo}`) : undefined}
              copiedLabel={t('caseCreation.invite.copied')}
            />
            <Text style={styles.confirmation} accessibilityLiveRegion="polite">
              {draft.invitation.tipo === 'email'
                ? t('caseCreation.invite.sandboxMessage')
                : t('caseCreation.invite.preparedMessage')}
            </Text>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                blurActiveElement();
                router.push('/case/create/success');
              }}
            >
              {t('caseCreation.invite.continue')}
            </Button>
          </View>
        ) : status === 'error' ? (
          <ErrorState
            title={t('caseCreation.invite.error.title')}
            retryLabel={t('common.retry')}
            onRetry={handlePrepare}
          />
        ) : (
          <Button variant="primary" size="lg" fullWidth disabled={!tipo || !pagoACargo} loading={status === 'submitting'} loadingLabel={t('common.loading')} onPress={handlePrepare}>
            {t('caseCreation.invite.sendInvitation')}
          </Button>
        )}
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
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: semanticColors.text.primary,
  },
  options: {
    gap: spacing.sm,
  },
  result: {
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
  confirmation: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
