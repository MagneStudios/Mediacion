import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
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
        <View style={styles.identity}>
          <View style={styles.iconContainer}>
            <Icon name="user" size={20} color={semanticColors.text.secondary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name} accessibilityRole="header">
              {profile.displayName}
            </Text>
            <Text style={styles.role}>{t(profile.roleLabelKey)}</Text>
          </View>
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
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  name: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  role: {
    ...typography.bodySm,
    color: semanticColors.text.tertiary,
  },
  summary: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaLabel: {
    ...typography.eyebrow,
    color: semanticColors.text.quaternary,
  },
  metaValue: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  notice: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
