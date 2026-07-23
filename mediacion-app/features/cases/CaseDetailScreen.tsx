import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AIProcessingState,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  StatusPill,
} from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { typography } from '../../design-system/tokens/typography';
import { spacing } from '../../design-system/tokens/spacing';
import { radii } from '../../design-system/tokens/radii';
import { useCaseDetail } from './hooks/useCaseDetail';

export type CaseDetailScreenProps = {
  caseId: string;
};

export function CaseDetailScreen({ caseId }: CaseDetailScreenProps) {
  const { t } = useTranslation();
  const { status, detail, reload, aiStatus, proposal, accepted, generateAiProposal, acceptAiProposal } =
    useCaseDetail(caseId);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <View style={styles.container}>
        <ErrorState
          title={t('states.error.title')}
          retryLabel={t('states.error.retry')}
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{detail.title}</Text>
      <Text style={styles.subtitle}>{t('caseDetail.caseCode', { code: detail.caseCode })}</Text>

      <View style={styles.privacyNotice}>
        <Icon name="lock" size={15} color={semanticColors.text.tertiary} />
        <Text style={styles.privacyText}>{t('caseDetail.privacyNotice')}</Text>
      </View>

      {detail.sharedProposal ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('caseDetail.sharedProposal')}</Text>
          <Card style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Avatar name={detail.sharedProposal.fromName} size="sm" />
              <Text style={styles.proposalTitle}>
                {t('caseDetail.from', { name: detail.sharedProposal.fromName })}
              </Text>
              <StatusPill status={detail.sharedProposal.status}>
                {t(`cases.status.${detail.statusLabelKey}`)}
              </StatusPill>
            </View>
            <Text style={styles.proposalText}>{detail.sharedProposal.summary}</Text>
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        {aiStatus === 'pending' ? (
          <AIProcessingState
            badgeLabel={t('caseDetail.aiBadge')}
            statusLabel={t('caseDetail.aiPending.status')}
            description={t('caseDetail.aiPending.description')}
          />
        ) : null}

        {aiStatus === 'done' && proposal ? (
          <Card style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Badge variant="ai" iconLeft={<Icon name="sparkles" size={12} color={semanticColors.ai.accent} />}>
                {t('caseDetail.aiBadge')}
              </Badge>
              <Text style={styles.proposalTitle}>{t('caseDetail.aiDone.title')}</Text>
            </View>
            <Text style={styles.proposalText}>{proposal.summary}</Text>
            <Text style={styles.disclaimer}>{t('caseDetail.aiDone.disclaimer')}</Text>
            {accepted ? (
              <View style={styles.acceptedRow}>
                <Icon name="check" size={16} color={semanticColors.status.successFg} />
                <Text style={styles.acceptedText}>{t('caseDetail.aiDone.accepted')}</Text>
              </View>
            ) : (
              <View style={styles.proposalActions}>
                <Button variant="primary" size="sm" onPress={acceptAiProposal}>
                  {t('caseDetail.aiDone.use')}
                </Button>
                <Button variant="tertiary" size="sm">
                  {t('caseDetail.aiDone.adjust')}
                </Button>
              </View>
            )}
          </Card>
        ) : null}

        {aiStatus === 'idle' ? (
          <Button
            variant="ai"
            fullWidth
            iconLeft={<Icon name="sparkles" size={16} color={semanticColors.action.aiFg} />}
            onPress={generateAiProposal}
          >
            {t('caseDetail.generateAi')}
          </Button>
        ) : null}
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
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 22,
    letterSpacing: -0.3,
    color: semanticColors.text.primary,
  },
  subtitle: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
    marginTop: -spacing.xs,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: semanticColors.text.secondary,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  proposalCard: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  proposalTitle: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  proposalText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
  disclaimer: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  acceptedText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.status.successFg,
  },
});
