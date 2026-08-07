import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { ActivityTimelineItem } from '@/features/notices/components/ActivityTimelineItem';
import { useMediatorActivity } from '@/features/mediator/hooks/useMediatorActivity';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAgreementDate } from '@/utils/format-agreement-date';

export default function MediatorActivityScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const result = useMediatorActivity(caseId);
  const { horizontalPadding } = useResponsiveLayout();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('mediator.activity.title') }} />
      <FlatList
        data={result.status === 'success' ? result.items : []}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
        ListHeaderComponent={
          <Text style={styles.title} accessibilityRole="header">
            {t('mediator.activity.title')}
          </Text>
        }
        renderItem={({ item }) => (
          <ActivityTimelineItem eventLabel={t(`mediator.activity.event.${item.eventKey}`)} dateLabel={formatAgreementDate(item.createdAt)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          result.status === 'loading' ? (
            <LoadingState label={t('common.loading')} />
          ) : result.status === 'error' ? (
            <ErrorState title={t('mediator.activity.error.title')} retryLabel={t('mediator.activity.error.retry')} onRetry={result.reload} />
          ) : (
            <EmptyState
              icon={<Icon name="inbox" size={28} color={semanticColors.text.tertiary} />}
              title={t('mediator.activity.empty.title')}
              description={t('mediator.activity.empty.description')}
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
