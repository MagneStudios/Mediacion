import { useRouter, type RelativePathString } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon, LoadingState } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { caseContextService } from '../../../services/case-context.service';
import { blurActiveElement } from '../../../utils/blur-active-element';
import type { CaseContext } from '../../../types/case-context';

export type CaseContextCardProps = {
  caseId: string;
};

export function CaseContextCard({ caseId }: CaseContextCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [context, setContext] = useState<CaseContext | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    caseContextService
      .getContext(caseId)
      .then((ctx) => {
        if (!cancelled) {
          setContext(ctx);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const completedCount = context?.completedSections.length ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Icon name="file-text" size={20} color={semanticColors.ai.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {t('caseContext.card.title')}
          </Text>
          {status === 'loading' ? (
            <LoadingState label={t('common.loading')} />
          ) : (
            <Text style={styles.progress}>
              {t('caseContext.card.progress', { completed: completedCount, total: 6 })}
            </Text>
          )}
        </View>
      </View>
      <Button
        variant="secondary"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push({ pathname: '/case/[id]/context/' as RelativePathString, params: { id: caseId } });
        }}
      >
        {t('caseContext.card.action')}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.supportAqua,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  progress: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
