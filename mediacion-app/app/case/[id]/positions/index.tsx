import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { useCaseDetail } from '@/features/cases/hooks/useCaseDetail';
import { DeletePositionDialog } from '@/features/positions/components/DeletePositionDialog';
import { PositionCard } from '@/features/positions/components/PositionCard';
import { useOwnPositions } from '@/features/positions/hooks/useOwnPositions';
import { positionsService } from '@/services/positions.service';
import type { PositionItem } from '@/types/position';
import { blurActiveElement } from '@/utils/blur-active-element';
import { getPositionEligibility } from '@/utils/position-eligibility';

export default function OwnPositionsScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const { status: caseStatus, detail, reload: reloadCase } = useCaseDetail(caseId);
  const positionsResult = useOwnPositions(caseId);

  const [deleteTarget, setDeleteTarget] = useState<PositionItem | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');

  if (caseStatus === 'loading') {
    return (
      <View style={styles.container}>
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (caseStatus === 'error' || !detail) {
    return (
      <View style={styles.container}>
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reloadCase} />
      </View>
    );
  }

  const eligibility = getPositionEligibility(detail.estado);
  const canManage = eligibility === 'editable';

  if (eligibility === 'ineligible') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('positions.dashboard.title') }} />
        <EmptyState
          icon={<Icon name="lock" size={28} color={semanticColors.text.tertiary} />}
          title={t('positions.ineligible.title')}
          description={t('positions.ineligible.description')}
        />
      </View>
    );
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteStatus === 'deleting') return;
    setDeleteStatus('deleting');
    try {
      await positionsService.deleteOwnPosition(caseId, deleteTarget.id);
      setDeleteTarget(null);
      setDeleteStatus('idle');
      if (positionsResult.status === 'success' || positionsResult.status === 'empty') {
        positionsResult.refresh();
      }
    } catch {
      setDeleteStatus('error');
    }
  };

  const items = positionsResult.status === 'success' ? positionsResult.items : [];

  const handleOpenPosition = (positionId: string) => {
    blurActiveElement();
    router.push({
      pathname: '/case/[id]/positions/[positionId]/edit',
      params: { id: caseId, positionId },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('positions.dashboard.title') }} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('positions.dashboard.title')}
            </Text>
            <PrivacyNotice>{t('positions.dashboard.supportingCopy')}</PrivacyNotice>
            {positionsResult.status === 'success' && items.length > 0 ? (
              <Text style={styles.summary}>
                {t('positions.dashboard.summary', { count: items.length })}
              </Text>
            ) : null}
            {canManage ? (
              <Button
                variant="primary"
                fullWidth
                iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
                onPress={() => {
                  blurActiveElement();
                  router.push({ pathname: '/case/[id]/positions/create', params: { id: caseId } });
                }}
              >
                {t('positions.dashboard.createAction')}
              </Button>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PositionCard
            categoryLabel={t(`positions.category.${item.category}.label`)}
            name={item.name}
            description={item.description}
            rangeLabel={t('positions.card.range', { min: item.valueMin, max: item.valueMax })}
            concedeLabel={item.canConcede ? t('positions.card.canConcedeYes') : t('positions.card.canConcedeNo')}
            canConcede={item.canConcede}
            canManage={canManage}
            onPress={() => handleOpenPosition(item.id)}
            onEdit={() => handleOpenPosition(item.id)}
            onDelete={() => setDeleteTarget(item)}
            editAccessibilityLabel={t('positions.card.editAccessibilityLabel', { name: item.name })}
            deleteAccessibilityLabel={t('positions.card.deleteAccessibilityLabel', { name: item.name })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          positionsResult.status === 'loading' ? (
            <LoadingState label={t('positions.dashboard.loading')} />
          ) : positionsResult.status === 'error' ? (
            <ErrorState
              title={t('positions.dashboard.error.title')}
              retryLabel={t('common.retry')}
              onRetry={positionsResult.reload}
            />
          ) : (
            <EmptyState
              icon={<Icon name="inbox" size={28} color={semanticColors.text.tertiary} />}
              title={t('positions.empty.title')}
              description={t('positions.empty.description')}
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onPress={() => {
                  blurActiveElement();
                  router.push({ pathname: '/case/[id]/positions/create', params: { id: caseId } });
                }}
                  >
                    {t('positions.empty.action')}
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      <DeletePositionDialog
        visible={deleteTarget != null}
        status={deleteStatus}
        title={t('positions.delete.title')}
        body={t('positions.delete.body', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('positions.delete.confirm')}
        cancelLabel={t('positions.delete.cancel')}
        errorTitle={t('positions.delete.error.title')}
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
    padding: spacing.md,
    flexGrow: 1,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
  },
  summary: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    color: semanticColors.text.tertiary,
  },
});
