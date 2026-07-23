import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState } from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { typography } from '../../design-system/tokens/typography';
import { spacing } from '../../design-system/tokens/spacing';
import type { CaseSummary } from '../../types/case';
import { CaseCard } from './components/CaseCard';
import { useCases } from './hooks/useCases';

export type CasesDashboardScreenProps = {
  onOpenCase: (caseSummary: CaseSummary) => void;
};

export function CasesDashboardScreen({ onOpenCase }: CasesDashboardScreenProps) {
  const { t } = useTranslation();
  const result = useCases();

  return (
    <View style={styles.container}>
      <FlatList
        data={result.status === 'success' ? result.cases : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.title} accessibilityRole="header">
            {t('cases.title')}
          </Text>
        }
        renderItem={({ item }) => <CaseCard caseSummary={item} onPress={() => onOpenCase(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListFooterComponent={
          result.status === 'success' ? (
            <Button
              variant="secondary"
              fullWidth
              iconLeft={<Icon name="plus" size={16} color={semanticColors.action.secondaryFg} />}
              style={styles.newCaseButton}
            >
              {t('cases.newCase')}
            </Button>
          ) : null
        }
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
    padding: spacing.md,
    flexGrow: 1,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 26,
    letterSpacing: -0.5,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
  },
  newCaseButton: {
    marginTop: spacing.xs,
  },
});
