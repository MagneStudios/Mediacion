import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../design-system/components/Button';
import { Card } from '../../../design-system/components/Card';
import { Icon } from '../../../design-system/components/Icon';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { NoticeCategory } from '../../../types/notice';
import { NoticeCategoryBadge } from './NoticeCategoryBadge';

export type NoticeCardProps = {
  category: NoticeCategory;
  categoryLabel: string;
  title: string;
  body: string;
  dateLabel: string;
  read: boolean;
  unreadLabel: string;
  readLabel: string;
  importantLabel?: string;
  caseLine?: string;
  actionable: boolean;
  onActivate: () => void;
  isMarking?: boolean;
  hasMarkError?: boolean;
  markErrorLabel?: string;
  markReadLabel?: string;
  onMarkRead?: () => void;
  emphasis?: 'normal' | 'warning';
};

/**
 * Dual-mode notice card:
 * - Actionable (a real destination): the whole Card is one interactive
 *   Pressable — activating it marks-then-navigates (see onActivate,
 *   composed by the caller).
 * - Informational (no destination): the Card stays non-interactive, and a
 *   sibling "Marcar como leído" Button — shown only while unread — is the
 *   only interactive element. Never nested inside another Pressable.
 */
export function NoticeCard({
  category,
  categoryLabel,
  title,
  body,
  dateLabel,
  read,
  unreadLabel,
  readLabel,
  importantLabel,
  caseLine,
  actionable,
  onActivate,
  isMarking,
  hasMarkError,
  markErrorLabel,
  markReadLabel,
  onMarkRead,
  emphasis = 'normal',
}: NoticeCardProps) {
  const content = (
    <>
      <View style={styles.headerRow}>
        <NoticeCategoryBadge category={category} label={categoryLabel} />
        {importantLabel ? (
          <View style={styles.importantPill}>
            <Icon name="alert-circle" size={12} color={semanticColors.status.warningFg} />
            <Text style={styles.importantText}>{importantLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {caseLine ? <Text style={styles.caseLine}>{caseLine}</Text> : null}

      <View style={styles.footerRow}>
        <Text style={styles.date} accessibilityLabel={dateLabel}>
          {dateLabel}
        </Text>
        <Text style={[styles.readMarker, !read ? styles.unreadMarker : null]} accessibilityLabel={read ? readLabel : unreadLabel}>
          {read ? readLabel : unreadLabel}
        </Text>
      </View>

      {hasMarkError ? <Text style={styles.errorText}>{markErrorLabel}</Text> : null}
    </>
  );

  if (actionable) {
    return (
      <Card
        interactive
        onPress={onActivate}
        accessibilityLabel={title}
        accessibilityState={{ busy: Boolean(isMarking), selected: !read }}
        style={[styles.card, emphasis === 'warning' ? styles.cardWarning : null]}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card style={[styles.card, emphasis === 'warning' ? styles.cardWarning : null]}>
      {content}
      {!read && onMarkRead ? (
        <Button variant="secondary" size="sm" onPress={onMarkRead} disabled={isMarking} style={styles.markReadButton}>
          {markReadLabel}
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardWarning: {
    borderColor: semanticColors.status.warningFg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  importantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  importantText: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.status.warningFg,
  },
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  body: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13.5,
    lineHeight: 20,
    color: semanticColors.text.secondary,
  },
  caseLine: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  date: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
  readMarker: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
  unreadMarker: {
    color: semanticColors.text.primary,
  },
  errorText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    color: semanticColors.status.errorFg,
  },
  markReadButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
  },
});
