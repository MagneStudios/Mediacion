import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState, ResponsiveColumns, StatusPill } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { AgreementExportAction } from '@/features/agreements/components/AgreementExportAction';
import { BreachNoticeDialog } from '@/features/agreements/components/BreachNoticeDialog';
import { BreachNoticeForm } from '@/features/agreements/components/BreachNoticeForm';
import { DocumentPreparationState } from '@/features/agreements/components/DocumentPreparationState';
import { SharedAgreementCard } from '@/features/agreements/components/SharedAgreementCard';
import { SignatureProgressCard } from '@/features/agreements/components/SignatureProgressCard';
import { useAgreement } from '@/features/agreements/hooks/useAgreement';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatAgreementDate } from '@/utils/format-agreement-date';

export default function AgreementDashboardScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload, prepareStatus, prepareDocument } = useAgreement(caseId);
  const { horizontalPadding, isWide } = useResponsiveLayout();

  const [breachDescription, setBreachDescription] = useState('');
  const [breachSubmitAttempted, setBreachSubmitAttempted] = useState(false);
  const [breachDialogVisible, setBreachDialogVisible] = useState(false);

  useEffect(() => {
    setBreachDescription('');
    setBreachSubmitAttempted(false);
    setBreachDialogVisible(false);
  }, [caseId, state?.agreement.id]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />
        <EmptyState
          title={t('agreement.dashboard.empty.title')}
          description={t('agreement.dashboard.empty.description')}
        />
      </View>
    );
  }

  const { agreement, signers, waitingForOtherParty, allSignaturesComplete, canPrepareDocument, canSign, readOnly } = state;

  // Mirrors the backend's own gate on POST /acuerdos/:id/incumplimiento
  // (only `firmado`/`con_aviso` agreements are breachable — anything else
  // is a 422 `acuerdo_not_firmado`). Deliberately not derived from
  // `readOnly`: that flag also covers unrecognized terminal states and, in
  // this file, is otherwise used to mean "nothing left to do here" — an
  // explicit `estado` check keeps this rule self-contained and correct
  // even if `readOnly`'s definition changes later.
  const canReportBreach = agreement.estado === 'firmado' || agreement.estado === 'con_aviso';
  const breachDescriptionError =
    breachSubmitAttempted && breachDescription.trim().length === 0 ? t('agreement.breachNotice.form.descriptionError') : undefined;

  const handleBreachSubmit = () => {
    if (breachDescription.trim().length === 0) {
      setBreachSubmitAttempted(true);
      return;
    }
    setBreachDialogVisible(true);
  };

  const handleBreachConfirm = () => {
    // Placeholder only — no incumplimientos service exists yet in this
    // phase. Intentionally just closes the dialog: never fabricate a
    // registered/success result without a real backend call behind it.
    setBreachDialogVisible(false);
  };

  const handleBreachCancel = () => {
    setBreachDialogVisible(false);
  };

  const statusLabel = agreement.estado === 'con_aviso'
    ? t('agreement.status.con_aviso')
    : allSignaturesComplete
      ? t('agreement.status.firmado')
      : agreement.estado === 'enviado_a_firma'
        ? t('agreement.status.enviado_a_firma')
        : t('agreement.status.borrador');
  const statusVisual = agreement.estado === 'con_aviso'
    ? 'warning'
    : allSignaturesComplete
      ? 'success'
      : agreement.estado === 'enviado_a_firma'
        ? 'info'
        : 'neutral';

  const primaryColumn = (
    <>
      <View style={styles.privacyBanner}>
        <Icon name="lock" size={18} color={semanticColors.text.tertiary} />
        <View style={styles.privacyTextCol}>
          <Text style={styles.privacyTitle}>{t('agreement.sharedMarker.title')}</Text>
          <Text style={styles.privacyBody}>{t('agreement.sharedMarker.body')}</Text>
        </View>
      </View>
      <SharedAgreementCard
        title={agreement.title}
        summary={agreement.summary}
        terms={agreement.terms}
        rationale={agreement.rationale}
        rationaleLabel={t('agreement.detail.rationaleTitle')}
        statusLabel={statusLabel}
        statusVisual={statusVisual}
      />
    </>
  );

  const secondaryColumn = (
    <>
      <View style={styles.signatureGroup}>
        <SignatureProgressCard
          title={t('agreement.progress.title')}
          signers={signers}
          ownRoleLabel={t('agreement.signer.own')}
          otherRoleLabel={t('agreement.signer.other')}
          signedStatusLabel={t('agreement.signer.signed')}
          pendingStatusLabel={t('agreement.signer.pending')}
          formatDate={formatAgreementDate}
        />
        {allSignaturesComplete ? <Text style={styles.bodyText}>{t('agreement.response.completed')}</Text> : null}
      </View>

      {canPrepareDocument ? (
        prepareStatus === 'pending' ? (
          <DocumentPreparationState title={t('agreement.prepare.preparingTitle')} description={t('agreement.prepare.preparingBody')} />
        ) : prepareStatus === 'error' ? (
          <ErrorState title={t('agreement.prepare.error.title')} retryLabel={t('common.retry')} onRetry={prepareDocument} />
        ) : (
          <Button variant="primary" size="lg" fullWidth onPress={prepareDocument}>
            {t('agreement.prepare.action')}
          </Button>
        )
      ) : null}

      {canSign ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.push({ pathname: '/case/[id]/agreement/sign', params: { id: caseId } });
          }}
        >
          {t('agreement.sign.goToAction')}
        </Button>
      ) : null}

      <AgreementExportAction
        status="idle"
        onExport={() => {
          // Placeholder only — no export service exists yet in this phase.
          // Intentionally a no-op: never fabricate a pending/success result
          // without a real backend call behind it.
        }}
        actionLabel={t('agreement.export.action')}
        exportingTitle={t('agreement.export.exportingTitle')}
        exportingBody={t('agreement.export.exportingBody')}
        successTitle={t('agreement.export.success.title')}
        successBody={t('agreement.export.success.body')}
        errorTitle={t('agreement.export.error.title')}
        retryLabel={t('common.retry')}
      />

      {waitingForOtherParty ? <Text style={styles.bodyText}>{t('agreement.response.waitingOther')}</Text> : null}

      {readOnly && agreement.estado === 'con_aviso' ? <Text style={styles.bodyText}>{t('agreement.status.conAvisoNotice')}</Text> : null}

      {canReportBreach ? (
        <View style={styles.breachGroup}>
          <BreachNoticeForm
            description={breachDescription}
            onChangeDescription={setBreachDescription}
            descriptionError={breachDescriptionError}
            status="idle"
            onSubmit={handleBreachSubmit}
            title={t('agreement.breachNotice.form.title')}
            descriptionLabel={t('agreement.breachNotice.form.descriptionLabel')}
            descriptionHint={t('agreement.breachNotice.form.descriptionHint')}
            descriptionPlaceholder={t('agreement.breachNotice.form.descriptionPlaceholder')}
            submitLabel={t('agreement.breachNotice.form.submitAction')}
            submittingLabel={t('agreement.breachNotice.form.submittingAction')}
          />
          <Button
            variant="tertiary"
            size="lg"
            fullWidth
            onPress={() => {
              blurActiveElement();
              router.push({ pathname: '/case/[id]/agreement/history', params: { id: caseId } });
            }}
          >
            {t('agreement.history.viewAction')}
          </Button>
        </View>
      ) : (
        <Button
          variant="tertiary"
          size="lg"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.push({ pathname: '/case/[id]/agreement/history', params: { id: caseId } });
          }}
        >
          {t('agreement.history.viewAction')}
        </Button>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />

        <View style={styles.headerRow}>
          <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
            {t('agreement.dashboard.title')}
          </Text>
          <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
        </View>

        <ResponsiveColumns primary={primaryColumn} secondary={secondaryColumn} />

        <BreachNoticeDialog
          visible={breachDialogVisible}
          status="idle"
          title={t('agreement.breachNotice.dialog.title')}
          body={t('agreement.breachNotice.dialog.body')}
          confirmLabel={t('agreement.breachNotice.dialog.confirmAction')}
          cancelLabel={t('agreement.breachNotice.dialog.cancel')}
          errorTitle={t('agreement.breachNotice.dialog.error.title')}
          retryLabel={t('common.retry')}
          onConfirm={handleBreachConfirm}
          onCancel={handleBreachCancel}
        />
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
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
    flexShrink: 1,
  },
  titleWide: {
    ...typography.displayLg,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  privacyTextCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  privacyTitle: {
    ...typography.eyebrow,
    color: semanticColors.text.primary,
  },
  privacyBody: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  bodyText: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  signatureGroup: {
    gap: spacing.xs,
  },
  breachGroup: {
    gap: spacing.xs,
  },
});
