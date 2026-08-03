import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, StatusPill } from '../../../design-system';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import { spacing } from '../../../design-system/tokens/spacing';
import type { CaseVisualStatus, MetodoCaso } from '../../../types/case';

export type CaseMetaBarProps = {
  metodo: MetodoCaso;
  visualStatus: CaseVisualStatus;
  statusLabelKey: string;
};

/** Compact row showing the case resolution method and current status — purely visual. */
export function CaseMetaBar({ metodo, visualStatus, statusLabelKey }: CaseMetaBarProps) {
  const { t } = useTranslation();

  const statusMap: Record<CaseVisualStatus, StatusPillStatus> = {
    success: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info',
    neutral: 'neutral',
    ai: 'ai',
  };

  return (
    <View style={styles.row}>
      <Badge variant="neutral">{t(`methods.${metodo}`)}</Badge>
      <StatusPill status={statusMap[visualStatus]}>{t(statusLabelKey)}</StatusPill>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
