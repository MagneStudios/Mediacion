import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DimensionValue } from 'react-native';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState, Text } from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '../../design-system/tokens/layout';
import { radii } from '../../design-system/tokens/radii';
import { spacing } from '../../design-system/tokens/spacing';
import { useResponsiveLayout } from '../../hooks/use-responsive-layout';
import type { CaseSummary } from '../../types/case';
import { CaseCard } from './components/CaseCard';
import { CaseFilters, type CaseFilterValue } from './components/CaseFilters';
import { CaseSummaryBar } from './components/CaseSummaryBar';
import { useCases } from './hooks/useCases';

export type CasesDashboardScreenProps = {
  onOpenCase: (caseSummary: CaseSummary) => void;
  onCreateCase: () => void;
};

export function CasesDashboardScreen({ onOpenCase, onCreateCase }: CasesDashboardScreenProps) {
  const { t } = useTranslation();
  const result = useCases();
  const { isWide, isExtraWide, horizontalPadding } = useResponsiveLayout();
  const [filter, setFilter] = useState<CaseFilterValue>('all');

  const allCases = result.status === 'success' ? result.cases : [];
  const filteredCases = useMemo(
    () => (filter === 'all' ? allCases : allCases.filter((c) => c.metodo === filter)),
    [allCases, filter],
  );
  const pendingResponseCount = useMemo(() => allCases.filter((c) => c.statusLabelKey === 'proposalReady').length, [allCases]);

  const numColumns = isExtraWide ? 3 : isWide ? 2 : 1;
  const columnGap = spacing.lg;
  const gridItemWidth = Platform.OS === 'web' && numColumns > 1
    ? (`calc((100% - ${columnGap * (numColumns - 1)}px) / ${numColumns})` as DimensionValue)
    : undefined;

  return (
    <View style={styles.container}>
      <FlatList
        key={numColumns}
        data={filteredCases}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: isExtraWide ? contentWidths.dashboardExtraWide : isWide ? contentWidths.dashboardWide : contentWidths.wide, horizontalPadding })]}
        ListHeaderComponent={
          <View style={[styles.header, isWide && styles.headerWide]}>
            <View style={[styles.headerTop, isWide && styles.headerTopWide]}>
              <View style={[styles.titleBlock, isWide && styles.titleBlockWide]}>
                <View style={[styles.eyebrowRow, isWide && styles.eyebrowRowWide]}>
                  <Icon name="folder-open" size={17} color={semanticColors.action.primaryBg} />
                  <Text variant="eyebrow" style={styles.eyebrow}>
                    {t('tabs.cases')}
                  </Text>
                </View>
                <Text variant={isWide ? 'displayLg' : 'headline'} accessibilityRole="header">
                  {t('cases.title')}
                </Text>
                <Text variant={isWide ? 'bodyLg' : 'body'} color="secondary" style={styles.description}>
                  {t('cases.description')}
                </Text>
              </View>
              <View style={[styles.headerAction, isWide && styles.headerActionWide]}>
                <Button
                  variant="primary"
                  fullWidth={!isWide}
                  size="lg"
                  iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
                  onPress={onCreateCase}
                >
                  {t('cases.createCase')}
                </Button>
              </View>
            </View>

            {result.status === 'success' && allCases.length > 0 ? (
              <View style={[styles.dashboardTools, isWide && styles.dashboardToolsWide]}>
                <CaseSummaryBar
                  total={allCases.length}
                  totalLabel={t('cases.summary.total')}
                  pendingResponse={pendingResponseCount}
                  pendingResponseLabel={t('cases.summary.pendingResponse')}
                />
                <View style={[styles.filters, isWide && styles.filtersWide]}>
                  <CaseFilters
                    value={filter}
                    onChange={setFilter}
                    allLabel={t('cases.filters.all')}
                    methodLabels={{
                      negociacion: t('methods.negociacion'),
                      conciliacion: t('methods.conciliacion'),
                      mediacion: t('methods.mediacion'),
                    }}
                  />
                </View>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? [styles.gridItem, { width: gridItemWidth }] : undefined}>
            <CaseCard caseSummary={item} onPress={() => onOpenCase(item)} isWide={numColumns > 1} />
          </View>
        )}
        ItemSeparatorComponent={numColumns > 1 ? undefined : () => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          result.status === 'loading' ? (
            <LoadingState label={t('cases.loading')} />
          ) : result.status === 'error' ? (
            <ErrorState
              title={t('cases.error.title')}
              description={t('cases.error.description')}
              retryLabel={t('cases.error.retry')}
              onRetry={result.reload}
            />
          ) : result.status === 'empty' ? (
            <EmptyState
              icon={<Icon name="folder-open" size={28} color={semanticColors.text.tertiary} />}
              title={t('cases.empty.title')}
              description={t('cases.empty.description')}
            />
          ) : null
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  columnWrapper: {
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  gridItem: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    marginBottom: spacing.lg,
  },
  header: {
    width: '100%',
    alignSelf: 'stretch',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  headerWide: {
    gap: spacing.lg,
  },
  headerTop: {
    gap: spacing.lg,
  },
  headerTopWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    maxWidth: 720,
    gap: spacing.xs,
  },
  titleBlockWide: {
    gap: spacing.xxs,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  eyebrowRowWide: {
    marginBottom: 0,
  },
  eyebrow: {
    color: semanticColors.action.primaryBg,
    textTransform: 'uppercase',
    letterSpacing: 1.25,
  },
  description: {
    maxWidth: 640,
  },
  headerAction: {
    width: '100%',
  },
  headerActionWide: {
    width: 'auto',
    flexShrink: 0,
  },
  dashboardTools: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
    borderRadius: radii.xl,
    backgroundColor: semanticColors.surface.card,
  },
  dashboardToolsWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  filters: {
    minWidth: 0,
  },
  filtersWide: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 420,
    alignItems: 'flex-end',
  },
});
