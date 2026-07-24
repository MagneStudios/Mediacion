import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { SharedMediatorProfile } from '../../../types/mediator';
import { formatAgreementDate } from '../../../utils/format-agreement-date';

export type SharedMediatorProfileCardProps = {
  profile: SharedMediatorProfile;
  assignedAt?: string;
};

/**
 * Sanitized, fictional demo mediator profile — no email, phone, address,
 * identity document, estudio membership, credentials, license/matrícula,
 * rating, or payment data. `profile.id` is never rendered here. See
 * types/mediator.ts for the privacy boundary this type sits behind.
 */
export function SharedMediatorProfileCard({ profile, assignedAt }: SharedMediatorProfileCardProps) {
  const { t } = useTranslation();
  const languageLabel = profile.languageCodes.map((code) => t(`mediator.profile.languages.${code}`)).join(' · ');

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Icon name="user" size={20} color={semanticColors.text.secondary} />
        <View style={styles.headerText}>
          <Text style={styles.name} accessibilityRole="header">
            {profile.displayName}
          </Text>
          <Text style={styles.role}>{t(profile.roleLabelKey)}</Text>
        </View>
        <Badge variant="neutral">{t('mediator.profile.demoLabel')}</Badge>
      </View>

      <Text style={styles.summary}>{t(profile.summaryKey)}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('mediator.profile.languagesLabel')}</Text>
        <Text style={styles.metaValue}>{languageLabel}</Text>
      </View>

      {assignedAt ? (
        <Text style={styles.metaValue}>{t('mediator.profile.assignedAtLabel', { date: formatAgreementDate(assignedAt) })}</Text>
      ) : null}

      <Text style={styles.notice}>{t('mediator.profile.notVerifiedNotice')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    color: semanticColors.text.primary,
  },
  role: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    color: semanticColors.text.tertiary,
  },
  summary: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  metaLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.quaternary,
  },
  metaValue: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    color: semanticColors.text.secondary,
  },
  notice: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: semanticColors.text.tertiary,
  },
});
