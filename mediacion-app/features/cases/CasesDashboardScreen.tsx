import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState } from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '../../design-system/tokens/layout';
import { typography } from '../../design-system/tokens/typography';
import { spacing } from '../../design-system/tokens/spacing';
import { useResponsiveLayout } from '../../hooks/use-responsive-layout';
import type { CaseSummary } from '../../types/case';
import { CaseCard } from './components/CaseCard';
import { useCases } from './hooks/useCases';

export type CasesDashboardScreenProps = {
  onOpenCase: (caseSummary: CaseSummary) => void;
  onCreateCase: () => void;
};

export function CasesDashboardScreen({ onOpenCase, onCreateCase }: CasesDashboardScreenProps) {
  const { t } = useTranslation();
  const result = useCases();
  const { isWide, horizontalPadding } = useResponsiveLayout();
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
        data={result.status === 'success' ? result.cases : []}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('cases.title')}
            </Text>
            <Button
              variant="primary"
              fullWidth
              iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
              onPress={onCreateCase}
            >
              {t('cases.createCase')}
            </Button>
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
  columnWrapper: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 26,
    letterSpacing: -0.5,
    color: semanticColors.text.primary,
  },
});
