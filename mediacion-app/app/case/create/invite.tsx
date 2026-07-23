import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState, Input, SelectableCard } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CaseCreationProgress } from '@/features/cases/components/CaseCreationProgress';
import { InvitationResultCard } from '@/features/cases/components/InvitationResultCard';
import { useCaseCreationFlow } from '@/features/cases/hooks/useCaseCreationFlow';
import { casesService } from '@/services/cases.service';
import type { TipoInvitacion } from '@/types/case';
import { isValidEmail } from '@/utils/validate-email';

const TIPOS: TipoInvitacion[] = ['link', 'codigo', 'email'];

type InviteStatus = 'idle' | 'submitting' | 'error';

export default function CaseCreateInviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, setInvitationResult } = useCaseCreationFlow();

  const [tipo, setTipo] = useState<TipoInvitacion | null>(null);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState<InviteStatus>('idle');

  const emailError = emailTouched && tipo === 'email' && !isValidEmail(email) ? t('caseCreation.invite.emailError') : undefined;

  const handlePrepare = async () => {
    if (status === 'submitting' || !tipo || !draft.caseId) return;

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
      });
      setInvitationResult(invitation);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  if (!draft.caseId) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState title={t('caseCreation.review.error.title')} retryLabel={t('caseCreation.method.back')} onRetry={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: '' }} />
        <CaseCreationProgress step={4} total={4} label={t('caseCreation.progress', { step: 4, total: 4 })} />

        <Text style={styles.title}>{t('caseCreation.invite.title')}</Text>
        <Text style={styles.subtitle}>{t('caseCreation.invite.subtitle')}</Text>

        {TIPOS.map((option) => (
          <SelectableCard
            key={option}
            icon={option === 'link' ? 'send' : option === 'codigo' ? 'lock' : 'messages-square'}
            title={t(`caseCreation.invite.method.${option}.title`)}
            description={t(`caseCreation.invite.method.${option}.description`)}
            selected={tipo === option}
            selectedLabel={t('caseCreation.method.selected')}
            onPress={() => setTipo(option)}
          />
        ))}

        {tipo === 'email' ? (
          <Input
            label={t('caseCreation.invite.emailLabel')}
            placeholder={t('caseCreation.invite.emailPlaceholder')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (emailTouched) setEmailTouched(false);
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}

        {draft.invitation ? (
          <>
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
            <Button variant="primary" fullWidth onPress={() => router.push('/case/create/success')}>
              {t('caseCreation.invite.continue')}
            </Button>
          </>
        ) : status === 'error' ? (
          <ErrorState
            title={t('caseCreation.invite.error.title')}
            retryLabel={t('common.retry')}
            onRetry={handlePrepare}
          />
        ) : (
          <Button variant="primary" fullWidth disabled={!tipo || status === 'submitting'} onPress={handlePrepare}>
            {status === 'submitting' ? t('common.loading') : t('caseCreation.invite.sendInvitation')}
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
  confirmation: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    color: semanticColors.text.secondary,
  },
});
