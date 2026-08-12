import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { DeletePlanDialog } from '@/features/admin/planes/components/DeletePlanDialog';
import { PlanCard } from '@/features/admin/planes/components/PlanCard';
import { usePlans } from '@/features/plans/hooks/usePlans';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { plansService } from '@/services/plans.service';
import type { Plan } from '@/types/plan';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function AdminPlanesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const result = usePlans();

  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteStatus === 'deleting') return;
    setDeleteStatus('deleting');
    try {
      await plansService.deletePlan(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteStatus('idle');
      if (result.status === 'success' || result.status === 'empty') {
        result.refresh();
      }
    } catch {
      setDeleteStatus('error');
    }
  };

  const plans = result.status === 'success' ? result.plans : [];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('admin.planes.title') }} />
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, getResponsiveContentStyle({ maxWidth: contentWidths.standard, horizontalPadding })]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.intro}>
              <Text style={styles.title} accessibilityRole="header">
                {t('admin.planes.title')}
              </Text>
              <Text style={styles.description}>{t('admin.planes.description')}</Text>
            </View>
            {result.status === 'success' && plans.length > 0 ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
                onPress={() => {
                  blurActiveElement();
                  router.push('/admin/planes/create');
                }}
              >
                {t('admin.planes.createAction')}
              </Button>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PlanCard
            plan={item}
            casosLabel={t('admin.planes.card.casosLabel')}
            carpetasLabel={t('admin.planes.card.carpetasLabel')}
            iteracionesLabel={t('admin.planes.card.iteracionesLabel')}
            onEdit={() => {
              blurActiveElement();
              router.push({ pathname: '/admin/planes/[id]/edit', params: { id: item.id } });
            }}
            onDelete={() => setDeleteTarget(item)}
            editAccessibilityLabel={t('admin.planes.card.editAccessibilityLabel', { nombre: item.nombre })}
            deleteAccessibilityLabel={t('admin.planes.card.deleteAccessibilityLabel', { nombre: item.nombre })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          result.status === 'loading' ? (
            <LoadingState label={t('common.loading')} />
          ) : result.status === 'error' ? (
            <ErrorState title={t('admin.planes.error.title')} retryLabel={t('common.retry')} onRetry={result.reload} />
          ) : (
            <EmptyState
              icon={<Icon name="wallet" size={28} color={semanticColors.text.tertiary} />}
              title={t('admin.planes.empty.title')}
              description={t('admin.planes.empty.description')}
              action={
                <Button
                  variant="primary"
                  size="lg"
                  onPress={() => {
                    blurActiveElement();
                    router.push('/admin/planes/create');
                  }}
                >
                  {t('admin.planes.createAction')}
                </Button>
              }
            />
          )
        }
      />

      <DeletePlanDialog
        visible={deleteTarget != null}
        status={deleteStatus}
        title={t('admin.planes.delete.title')}
        body={t('admin.planes.delete.body', { nombre: deleteTarget?.nombre ?? '' })}
        confirmLabel={t('admin.planes.delete.confirm')}
        cancelLabel={t('admin.planes.delete.cancel')}
        errorTitle={t('admin.planes.delete.error.title')}
        retryLabel={t('common.retry')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (deleteStatus === 'deleting') return;
          setDeleteTarget(null);
          setDeleteStatus('idle');
        }}
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
  header: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  intro: {
    gap: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
