import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { AgreementHistoryCard } from '@/features/agreements/components/AgreementHistoryCard';
import { useAgreementHistory } from '@/features/agreements/hooks/useAgreementHistory';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAgreementDate } from '@/utils/format-agreement-date';

export default function AgreementHistoryScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const result = useAgreementHistory(caseId);
  const { horizontalPadding } = useResponsiveLayout();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('agreement.history.title') }} />
      <FlatList
        data={result.status === 'success' ? result.items : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
        ListHeaderComponent={
          <Text style={styles.title} accessibilityRole="header">
            {t('agreement.history.title')}
          </Text>
        }
        renderItem={({ item }) => (
          <AgreementHistoryCard eventLabel={t(`agreement.history.event.${item.eventKey}`)} dateLabel={formatAgreementDate(item.timestamp)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          result.status === 'loading' ? (
            <LoadingState label={t('common.loading')} />
          ) : result.status === 'error' ? (
            <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={result.reload} />
          ) : (
            <EmptyState
              icon={<Icon name="inbox" size={28} color={semanticColors.text.tertiary} />}
              title={t('agreement.history.empty.title')}
              description={t('agreement.history.empty.description')}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
    marginBottom: spacing.lg,
  },
});
