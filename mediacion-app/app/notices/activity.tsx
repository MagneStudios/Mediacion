import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { ActivityTimelineItem } from '@/features/notices/components/ActivityTimelineItem';
import { useActivity } from '@/features/notices/hooks/useActivity';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { ActivityListItem } from '@/types/activity';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatAgreementDate } from '@/utils/format-agreement-date';
import { resolveNoticeDestination } from '@/utils/resolve-notice-destination';

export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const result = useActivity();
  const { horizontalPadding } = useResponsiveLayout();

  const handleActivate = (item: ActivityListItem) => {
    const href = resolveNoticeDestination(item.destination);
    if (!href) return;
    blurActiveElement();
    router.push(href);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('activity.title') }} />
      <FlatList
        data={result.status === 'success' ? result.items : []}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: contentWidths.standard, horizontalPadding })]}
        ListHeaderComponent={
          <Text style={styles.title} accessibilityRole="header">
            {t('activity.title')}
          </Text>
        }
        renderItem={({ item }) => {
          const href = resolveNoticeDestination(item.destination);
          return (
            <ActivityTimelineItem
              eventLabel={t(`activity.event.${item.eventKey}`, item.params)}
              dateLabel={formatAgreementDate(item.createdAt)}
              caseLine={item.caseTitle ? t('activity.caseLine', { title: item.caseTitle }) : undefined}
              actionable={Boolean(href)}
              onPress={href ? () => handleActivate(item) : undefined}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          result.status === 'loading' ? (
            <LoadingState label={t('common.loading')} />
          ) : result.status === 'error' ? (
            <ErrorState title={t('activity.error.title')} retryLabel={t('activity.error.retry')} onRetry={result.reload} />
          ) : (
            <EmptyState
              icon={<Icon name="inbox" size={28} color={semanticColors.text.tertiary} />}
              title={t('activity.empty.title')}
              description={t('activity.empty.description')}
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
