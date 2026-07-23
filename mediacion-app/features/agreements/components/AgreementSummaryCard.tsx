import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { blurActiveElement } from '../../../utils/blur-active-element';
import { useAgreement } from '../hooks/useAgreement';

export type AgreementSummaryCardProps = {
  caseId: string;
};

/**
 * Compact, self-fetching agreement summary embedded in CaseDetailScreen.
 * CaseDetail never needs to know whether an agreement record already
 * exists — this component fetches it itself and renders a calm
 * "not available" state on a null result rather than inventing content.
 */
export function AgreementSummaryCard({ caseId }: AgreementSummaryCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state } = useAgreement(caseId);

  if (status === 'loading') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          {t('agreement.sectionTitle')}
        </Text>
        <Card style={styles.card}>
          <Text style={styles.description}>{t('common.loading')}</Text>
        </Card>
      </View>
    );
  }

  if (status === 'error' || !state) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          {t('agreement.sectionTitle')}
        </Text>
        <Card style={styles.card}>
          <Text style={styles.description}>{t('agreement.summary.unavailable')}</Text>
        </Card>
      </View>
    );
  }

  const statusLabel = state.allSignaturesComplete
    ? t('agreement.status.firmado')
    : state.agreement.estado === 'enviado_a_firma'
      ? t('agreement.status.enviado_a_firma')
      : state.agreement.estado === 'con_aviso'
        ? t('agreement.status.con_aviso')
        : t('agreement.status.borrador');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t('agreement.sectionTitle')}
      </Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>{t('agreement.summary.title')}</Text>
          <StatusPill status={state.allSignaturesComplete ? 'success' : 'info'}>{statusLabel}</StatusPill>
        </View>
        <Text style={styles.description}>{t('agreement.summary.body')}</Text>
        <Button
          variant="secondary"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.push({ pathname: '/case/[id]/agreement', params: { id: caseId } });
          }}
        >
          {t('agreement.summary.viewAction')}
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
