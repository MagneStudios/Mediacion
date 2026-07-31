import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState, Text } from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '../../design-system/tokens/layout';
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
  const { isWide, horizontalPadding } = useResponsiveLayout();
  const [filter, setFilter] = useState<CaseFilterValue>('all');

  const allCases = result.status === 'success' ? result.cases : [];
  const filteredCases = useMemo(
    () => (filter === 'all' ? allCases : allCases.filter((c) => c.metodo === filter)),
    [allCases, filter],
  );
  const pendingResponseCount = useMemo(() => allCases.filter((c) => c.statusLabelKey === 'proposalReady').length, [allCases]);

  const numColumns = isWide ? 2 : 1;

  return (
    <View style={styles.container}>
      <FlatList
        key={numColumns}
        data={filteredCases}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: isWide ? 1480 : contentWidths.wide, horizontalPadding })]}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Header: eyebrow + title + description left, CTA right */}
            <View style={[styles.headerTop, isWide && styles.headerTopWide]}>
              <View style={styles.titleBlock}>
                <Text variant="eyebrow" color="quaternary" style={styles.eyebrow}>
                  {t('cases.eyebrow')}
                </Text>
                <Text variant={isWide ? 'displayMd' : 'headline'} accessibilityRole="header">
                  {t('cases.title')}
                </Text>
                <Text variant="body" color="secondary" style={styles.description}>
                  {t('cases.description')}
                </Text>
              </View>
              <View style={[styles.headerRight, isWide && styles.headerRightWide]}>
                {result.status === 'success' && allCases.length > 0 ? (
                  <CaseSummaryBar
                    total={allCases.length}
                    totalLabel={t('cases.summary.total')}
                    pendingResponse={pendingResponseCount}
                    pendingResponseLabel={t('cases.summary.pendingResponse')}
                  />
                ) : null}
                <Button
                  variant="primary"
                  fullWidth={!isWide}
                  iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
                  onPress={onCreateCase}
                >
                  {t('cases.createCase')}
                </Button>
              </View>
            </View>

            {/* Filters toolbar */}
            {result.status === 'success' && allCases.length > 0 ? (
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
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          numColumns > 1 ? (
            <View style={styles.gridItem}>
              <CaseCard caseSummary={item} onPress={() => onOpenCase(item)} isWide />
            </View>
          ) : (
            <CaseCard caseSummary={item} onPress={() => onOpenCase(item)} />
          )
        }
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
    paddingVertical: spacing.xl,
    flexGrow: 1,
  },
  columnWrapper: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridItem: {
    flex: 1,
    maxWidth: '50%',
    minWidth: 0,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerTop: {
    gap: spacing.sm,
  },
  headerTopWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    marginBottom: spacing.xxs,
  },
  description: {
    marginTop: 4,
  },
  headerRight: {
    gap: spacing.sm,
  },
  headerRightWide: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
});
