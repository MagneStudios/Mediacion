import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { RoundHistoryCard } from '@/features/negotiation/components/RoundHistoryCard';
import { useRoundHistory } from '@/features/negotiation/hooks/useRoundHistory';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function NegotiationHistoryScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const result = useRoundHistory(caseId);
  const { horizontalPadding } = useResponsiveLayout();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('negotiation.history.title') }} />
      <FlatList
        data={result.status === 'success' ? result.items : []}
        keyExtractor={(item) => item.roundId}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: contentWidths.standard, horizontalPadding })]}
        ListHeaderComponent={
          <Text style={styles.title} accessibilityRole="header">
            {t('negotiation.history.title')}
          </Text>
        }
        renderItem={({ item }) => (
          <RoundHistoryCard
            roundLabel={t('negotiation.round.label', { number: item.roundNumber })}
            proposalTitle={item.proposalTitle}
            proposalSummary={item.proposalSummary}
            statusLabel={
              item.agreementReached ? t('negotiation.history.item.agreementReached') : t('negotiation.history.item.notAccepted')
            }
            statusVisual={item.agreementReached ? 'success' : 'warning'}
            dateLabel={item.completedAt}
          />
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
              title={t('negotiation.history.empty.title')}
              description={t('negotiation.history.empty.description')}
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
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
  },
});
