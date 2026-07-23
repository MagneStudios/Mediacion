import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import type { IconName } from '@/design-system/components/Icon';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { SignatureInboxCard } from '@/features/agreements/components/SignatureInboxCard';
import { useSignatureInbox } from '@/features/agreements/hooks/useSignatureInbox';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { SignatureInboxItem } from '@/types/agreement';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatAgreementDate } from '@/utils/format-agreement-date';

export default function SignaturesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const result = useSignatureInbox();
  const { horizontalPadding } = useResponsiveLayout();

  const openAgreement = (caseId: string) => {
    blurActiveElement();
    router.push({ pathname: '/case/[id]/agreement', params: { id: caseId } });
  };

  if (result.status === 'loading') {
    return (
      <View style={styles.container}>
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (result.status === 'error') {
    return (
      <View style={styles.container}>
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={result.reload} />
      </View>
    );
  }

  const items = result.status === 'success' ? result.items : [];
  const pending = items.filter((item) => item.estado === 'borrador' || (item.estado === 'enviado_a_firma' && item.ownStatus === 'pendiente'));
  const waitingOther = items.filter((item) => item.estado === 'enviado_a_firma' && item.ownStatus === 'firmado');
  const completed = items.filter((item) => item.estado === 'firmado');
  const withNotice = items.filter((item) => item.estado === 'con_aviso');

  const statusLabelFor = (item: SignatureInboxItem) =>
    item.estado === 'firmado'
      ? t('agreement.status.firmado')
      : item.estado === 'con_aviso'
        ? t('agreement.status.con_aviso')
        : item.estado === 'enviado_a_firma'
          ? t('agreement.status.enviado_a_firma')
          : t('agreement.status.borrador');

  const renderGroup = (
    title: string,
    groupItems: SignatureInboxItem[],
    statusVisual: 'neutral' | 'info' | 'success' | 'warning',
    statusIcon: IconName,
  ) =>
    groupItems.length > 0 ? (
      <View style={styles.section} key={title}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.list}>
          {groupItems.map((item) => (
            <SignatureInboxCard
              key={item.caseId}
              caseTitle={item.caseTitle}
              agreementTitle={item.agreementTitle}
              statusLabel={statusLabelFor(item)}
              statusVisual={statusVisual}
              statusIcon={statusIcon}
              dateLabel={item.completedAt ? formatAgreementDate(item.completedAt) : undefined}
              reviewLabel={t('agreement.inbox.reviewAction')}
              onReview={() => openAgreement(item.caseId)}
            />
          ))}
        </View>
      </View>
    ) : null;

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={<Icon name="file-signature" size={28} color={semanticColors.text.tertiary} />}
          title={t('agreement.inbox.empty.title')}
          description={t('agreement.inbox.empty.description')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.standard, horizontalPadding })]}
    >
      <Text style={styles.title} accessibilityRole="header">
        {t('agreement.inbox.title')}
      </Text>
      {renderGroup(t('agreement.inbox.groups.pending'), pending, 'neutral', 'pencil')}
      {renderGroup(t('agreement.inbox.groups.waitingOther'), waitingOther, 'info', 'clock')}
      {renderGroup(t('agreement.inbox.groups.completed'), completed, 'success', 'shield-check')}
      {renderGroup(t('agreement.inbox.groups.withNotice'), withNotice, 'warning', 'alert-circle')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 26,
    letterSpacing: -0.5,
    color: semanticColors.text.primary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 13,
    color: semanticColors.text.tertiary,
  },
  list: {
    gap: spacing.sm,
  },
});
