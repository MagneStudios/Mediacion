import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../design-system/components/Button';
import { Card } from '../../../design-system/components/Card';
import { Divider } from '../../../design-system/components/Divider';
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
  isWide?: boolean;
};

/**
 * Stitch-inspired dual-mode notice card with desktop action-rail layout:
 *
 *   ┌── Category · time           [Importante] ⋯ ──────────┐
 *   │                                                        │
 *   │  Title                       [ Acción real (o ⋮ ) ]   │
 *   │  Description text here…                                │
 *   │                                                        │
 *   │  ────────────────────────────────────────────────────  │
 *   │  Case: Custodia · Date                                 │
 *   └────────────────────────────────────────────────────────┘
 *
 * - Actionable on desktop: body uses available width; the whole card
 *   is one interactive Pressable.
 * - Non-actionable + unread: "Marcar como leído" button in the right
 *   rail on desktop, in the footer on mobile.
 * - Read / informational: body fills the card with no rail.
 */
export function NoticeCard({
  category,
  categoryLabel,
  title,
  body,
  dateLabel,
  read,
  unreadLabel,
  readLabel: _readLabel,
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
  isWide = false,
}: NoticeCardProps) {
  const hasRightRail = isWide && (!read && !actionable && onMarkRead != null);

  const content = (
    <>
      {/* ---- header line ---- */}
      <View style={styles.headerLine}>
        <View style={styles.headerLeft}>
          <NoticeCategoryBadge category={category} label={categoryLabel} />
          <Text style={styles.dot}>·</Text>
          <Text style={styles.timeLabel}>{dateLabel}</Text>
          {!read ? (
            <View style={styles.unreadPill} accessibilityLabel={unreadLabel}>
              <View style={styles.unreadDot} />
              <Text style={styles.unreadText}>{unreadLabel}</Text>
            </View>
          ) : null}
        </View>
        {importantLabel ? (
          <View style={styles.importantPill}>
            <Icon name="alert-circle" size={12} color={semanticColors.status.warningFg} />
            <Text style={styles.importantText}>{importantLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* ---- body area ---- */}
      {hasRightRail ? (
        <View style={styles.bodyWithRail}>
          <View style={styles.bodyColumn}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.description} numberOfLines={3}>
              {body}
            </Text>
          </View>
          <View style={styles.rightRail}>
            <Button variant="secondary" size="sm" onPress={onMarkRead} disabled={isMarking}>
              {markReadLabel}
            </Button>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.description} numberOfLines={3}>
            {body}
          </Text>
        </>
      )}

      {/* ---- divider + footer ---- */}
      {hasMarkError ? <Text style={styles.errorText}>{markErrorLabel}</Text> : null}

      <Divider tone="soft" />

      <View style={styles.footerRow}>
        <View style={styles.footerMeta}>
          {caseLine ? <Text style={styles.caseLine}>{caseLine}</Text> : null}
        </View>
        {!actionable && !read && onMarkRead && !hasRightRail ? (
          <Button variant="secondary" size="sm" onPress={onMarkRead} disabled={isMarking}>
            {markReadLabel}
          </Button>
        ) : null}
      </View>
    </>
  );

  const accentStyle =
    emphasis === 'warning'
      ? styles.accentWarning
      : !read
        ? styles.accentUnread
        : styles.accentRead;
  const quietStyle = read && !actionable ? styles.cardQuiet : null;

  if (actionable) {
    return (
      <Card
        interactive
        onPress={onActivate}
        accessibilityLabel={title}
        accessibilityState={{ busy: Boolean(isMarking), selected: !read }}
        style={[styles.card, accentStyle, quietStyle]}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card style={[styles.card, accentStyle, quietStyle]}>
      {content}
    </Card>
  );
}

const DOT_SIZE = 8;
const UNREAD_DOT_SIZE = 6;

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  cardQuiet: {
    borderColor: semanticColors.border.soft,
  },
  accentUnread: {
    borderColor: semanticColors.border.default,
    borderLeftColor: semanticColors.text.primary,
  },
  accentWarning: {
    borderColor: semanticColors.status.warningFg,
    borderLeftColor: semanticColors.status.warningFg,
  },
  accentRead: {
    borderColor: semanticColors.border.default,
    borderLeftColor: 'transparent',
  },

  /* ---- header line ---- */
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  dot: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.quaternary,
    lineHeight: 14,
  },
  timeLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unreadDot: {
    width: UNREAD_DOT_SIZE,
    height: UNREAD_DOT_SIZE,
    borderRadius: UNREAD_DOT_SIZE / 2,
    backgroundColor: semanticColors.text.primary,
  },
  unreadText: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.primary,
  },
  importantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  importantText: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.status.warningFg,
  },

  /* ---- body with rail ---- */
  bodyWithRail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bodyColumn: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  rightRail: {
    flexShrink: 0,
    justifyContent: 'center',
  },

  /* ---- body ---- */
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 15,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },

  /* ---- footer ---- */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  footerMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  caseLine: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
    flexShrink: 1,
  },

  /* ---- misc ---- */
  errorText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12,
    color: semanticColors.status.errorFg,
  },
});
