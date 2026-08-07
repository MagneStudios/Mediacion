import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { NoticesDemoNotice } from '@/features/notices/components/NoticesDemoNotice';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { DeadlineNoticeCard } from '@/features/notices/components/DeadlineNoticeCard';
import { MarkAllReadAction } from '@/features/notices/components/MarkAllReadAction';
import { NoticeCard } from '@/features/notices/components/NoticeCard';
import { NoticeFilter } from '@/features/notices/components/NoticeFilter';
import { NoticesHeader } from '@/features/notices/components/NoticesHeader';
import { useNotices } from '@/features/notices/hooks/useNotices';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { NoticeFilter as NoticeFilterValue, NoticeListItem } from '@/types/notice';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatAgreementDate } from '@/utils/format-agreement-date';
import { resolveNoticeDestination } from '@/utils/resolve-notice-destination';

export default function NoticeCenterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<NoticeFilterValue>('all');
  const { status, notices, reload, markingId, markErrorId, markOneRead, markAllStatus, markAllRead } = useNotices(filter);
  const { horizontalPadding, isWide } = useResponsiveLayout();

  const hasLoadedOnceRef = useRef(false);
  useEffect(() => {
    if (status === 'success') hasLoadedOnceRef.current = true;
  }, [status]);
  // A filter switch re-enters `status === 'loading'` for a ~500ms refetch. Once the
  // list has rendered at least once, keep the header and the current rows in place
  // instead of tearing down to a bare full-screen spinner on every tab change.
  const isRefetching = status === 'loading' && hasLoadedOnceRef.current;
  const showHeader = status === 'success' || isRefetching;

  const handleActivate = async (notice: NoticeListItem) => {
    const requiresCase = 'caseId' in notice.destination;
    if (requiresCase && !notice.caseTitle) return;
    const href = resolveNoticeDestination(notice.destination);
    if (!href) return;

    if (notice.read) {
      blurActiveElement();
      router.push(href);
      return;
    }

    const updated = await markOneRead(notice.id);
    if (updated) {
      blurActiveElement();
      router.push(href);
    }
  };

  const handleViewActivity = () => {
    blurActiveElement();
    router.push('/notices/activity');
  };

  const unreadCount = notices.filter((notice) => !notice.read).length;

  const listHeader =
    showHeader ? (
      <View style={styles.headerSection}>
        <NoticesHeader title={t('notices.title')} unreadCount={unreadCount} isWide={isWide} />

        <View style={[styles.controlBar, isWide && styles.controlBarWide]}>
          <NoticeFilter
            value={filter}
            onChange={setFilter}
            allLabel={t('notices.filters.all')}
            unreadLabel={t('notices.filters.unread')}
            isWide={isWide}
          />
          <View style={[styles.controlActions, isWide && styles.controlActionsWide]}>
            <MarkAllReadAction
              label={t('notices.markAllAction')}
              pendingLabel={t('notices.markAllPending')}
              onPress={markAllRead}
              disabled={unreadCount === 0}
              pending={markAllStatus === 'pending'}
              fullWidth={!isWide}
            />
            <Button variant="tertiary" fullWidth={!isWide} onPress={handleViewActivity}>
              {t('notices.viewActivityAction')}
            </Button>
          </View>
        </View>

        <View style={[styles.infoRow, isWide && styles.infoRowWide]}>
          <View style={styles.infoItem}>
            <NoticesDemoNotice title={t('notices.demoNotice.title')} body={t('notices.demoNotice.body')} />
          </View>
          <View style={styles.infoItem}>
            <PrivacyNotice title={t('notices.privacyNotice.title')}>{t('notices.privacyNotice.body')}</PrivacyNotice>
          </View>
        </View>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={status === 'error' ? [] : notices}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        style={[isRefetching && styles.listRefetching]}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: isWide ? contentWidths.workspaceWide : contentWidths.standard, horizontalPadding })]}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => {
          const CardComponent = item.category === 'deadline' ? DeadlineNoticeCard : NoticeCard;
          return (
            <CardComponent
              category={item.category}
              categoryLabel={t(`notices.category.${item.category}`)}
              title={t(item.titleKey, item.params)}
              body={t(item.bodyKey, item.params)}
              dateLabel={formatAgreementDate(item.createdAt)}
              read={item.read}
              readLabel={t('notices.readLabel')}
              unreadLabel={t('notices.unreadLabel')}
              importantLabel={item.priority === 'important' ? t('notices.importantLabel') : undefined}
              caseLine={item.caseTitle ? t('notices.caseLine', { title: item.caseTitle }) : undefined}
              actionable={item.destination.type !== 'none'}
              onActivate={() => handleActivate(item)}
              isMarking={markingId === item.id}
              hasMarkError={markErrorId === item.id}
              markErrorLabel={t('notices.markReadError')}
              markReadLabel={t('notices.markReadAction')}
              onMarkRead={() => markOneRead(item.id)}
              isWide={isWide}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          status === 'loading' ? (
            <LoadingState label={t('common.loading')} />
          ) : status === 'error' ? (
            <ErrorState title={t('notices.error.title')} retryLabel={t('notices.error.retry')} onRetry={reload} />
          ) : (
            <EmptyState
              icon={<Icon name="bell" size={28} color={semanticColors.text.tertiary} />}
              title={filter === 'unread' ? t('notices.noUnread') : t('notices.empty.title')}
              description={filter === 'unread' ? undefined : t('notices.empty.description')}
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
    flexGrow: 1,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  listRefetching: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
  headerSection: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoRowWide: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoItem: {
    flex: 1,
  },
  controlBar: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: semanticColors.surface.card,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
    borderRadius: radii.xl,
  },
  controlBarWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  controlActions: {
    gap: spacing.xs,
  },
  controlActionsWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
