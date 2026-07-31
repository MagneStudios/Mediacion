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
  // Client-side filter over the already-fetched list — same pattern as
  // NoticeFilter in the Avisos tab. No service/hook change: `useCases()` is
  // never called again, this only narrows the array already in memory.
  const filteredCases = useMemo(
    () => (filter === 'all' ? allCases : allCases.filter((c) => c.metodo === filter)),
    [allCases, filter],
  );
  const pendingResponseCount = useMemo(() => allCases.filter((c) => c.statusLabelKey === 'proposalReady').length, [allCases]);

  // Two columns at `wide` and above (never three/four, even at extraWide —
  // isWide alone already covers that whole range). RN requires a remount
  // when numColumns changes; `key` forces that safely. The list has no
  // internal state tied to a specific render (read-only data from
  // useCases()), so recreation loses nothing.
  const numColumns = isWide ? 2 : 1;

  return (
    <View style={styles.container}>
      <FlatList
        key={numColumns}
        data={filteredCases}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.listContent, isWide ? null : styles.listContentMobile, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
        ListHeaderComponent={
          <View style={[styles.header, isWide ? null : styles.headerCompact]}>
            <View style={[styles.headerTop, isWide ? styles.headerTopWide : null]}>
              <View style={isWide ? styles.titleWide : undefined}>
                <Text variant={isWide ? 'displayLg' : 'headline'} accessibilityRole="header">
                  {t('cases.title')}
                </Text>
                <Text variant="body" color="secondary" style={[styles.description, isWide ? null : styles.descriptionCompact]}>
                  {t('cases.description')}
                </Text>
              </View>
              <Button
                variant="primary"
                fullWidth={!isWide}
                iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
                onPress={onCreateCase}
              >
                {t('cases.createCase')}
              </Button>
            </View>
            {result.status === 'success' && allCases.length > 0 ? (
              <CaseSummaryBar
                total={allCases.length}
                totalLabel={t('cases.summary.total')}
                pendingResponse={pendingResponseCount}
                pendingResponseLabel={t('cases.summary.pendingResponse')}
              />
            ) : null}
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
              <CaseCard caseSummary={item} onPress={() => onOpenCase(item)} />
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
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  listContentMobile: {
    paddingBottom: spacing.xxl,
  },
  columnWrapper: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerCompact: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTop: {
    gap: spacing.sm,
  },
  // Wide web: title left, compact intrinsic-width CTA right — never a
  // hardcoded button width, `fullWidth={false}` already sizes the button to
  // its own content (see Button.tsx). Mobile/medium keep the original
  // column layout (title above a full-width button) untouched.
  headerTopWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWide: {
    flex: 1,
  },
  description: {
    marginTop: 4,
  },
  descriptionCompact: {
    marginTop: 2,
  },
});
