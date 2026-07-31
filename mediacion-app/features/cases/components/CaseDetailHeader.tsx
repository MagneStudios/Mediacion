import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { CaseDetail } from '../../../types/case';
import { CaseMetaBar } from './CaseMetaBar';

export type CaseDetailHeaderProps = {
  detail: CaseDetail;
  isWide: boolean;
};

/** Workspace header — open composition, not a generic card. Pure visual, no business logic. */
export function CaseDetailHeader({ detail, isWide }: CaseDetailHeaderProps) {
  const { t } = useTranslation();

  const roundLabel =
    detail.roundNumber != null ? t('cases.round', { number: detail.roundNumber }) : null;

  const subinfoParts = [detail.counterpartyName, roundLabel].filter(Boolean);

  return (
    <View style={[styles.container, isWide && styles.containerWide]}>
      <View style={styles.main}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {detail.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.caseCode}>{t('caseDetail.caseCode', { code: detail.caseCode })}</Text>
          <View style={styles.dot} />
          <CaseMetaBar
            metodo={detail.metodo}
            visualStatus={detail.visualStatus}
            statusLabelKey={`cases.status.${detail.statusLabelKey}`}
          />
        </View>
        {subinfoParts.length > 0 ? (
          <Text style={styles.subinfo}>{subinfoParts.join(' · ')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const DOT_SIZE = 3;

const styles = StyleSheet.create({
  container: {
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  containerWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 22,
    letterSpacing: -0.3,
    color: semanticColors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  caseCode: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: semanticColors.text.quaternary,
  },
  subinfo: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
