import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../design-system/components/Button';
import { Card } from '../../../design-system/components/Card';
import { Divider } from '../../../design-system/components/Divider';
import { Icon } from '../../../design-system/components/Icon';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { NoticeCategory } from '../../../types/notice';
import { getNoticeCategoryTone, NoticeCategoryBadge } from './NoticeCategoryBadge';

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
  const showMarkRead = !actionable && !read && onMarkRead != null;
  const showFooter = caseLine != null || showMarkRead || actionable;
  const categoryTone = getNoticeCategoryTone(category);
  // The info-tone card tints its whole background the same soft blue as the
  // default unread-pill fill — on that surface the pill needs a white fill to
  // stay legible as a distinct marker instead of blending into the card.
  const onTintedSurface = !read && categoryTone === 'info';

  const content = (
    <>
      {/* ---- header line ---- */}
      <View style={styles.headerLine}>
        <View style={styles.headerLeft}>
          <NoticeCategoryBadge category={category} label={categoryLabel} />
          <Text style={styles.dot}>·</Text>
          <Text style={styles.timeLabel}>{dateLabel}</Text>
          {!read ? (
            <View style={[styles.unreadPill, onTintedSurface && styles.unreadPillOnTint]} accessibilityLabel={unreadLabel}>
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

      {/* ---- body ---- */}
      <Text style={[styles.title, isWide && styles.titleWide]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.description, isWide && styles.descriptionWide]}>
        {body}
      </Text>

      {/* ---- divider + footer ---- */}
      {hasMarkError ? <Text style={styles.errorText}>{markErrorLabel}</Text> : null}

      {showFooter ? (
        <View style={styles.footerSection}>
          <Divider tone="soft" />
          <View style={[styles.footerRow, isWide && styles.footerRowWide]}>
            <View style={styles.footerMeta}>
              {caseLine ? <Text style={styles.caseLine}>{caseLine}</Text> : null}
            </View>
            {showMarkRead ? (
              <Button variant="primary" size="sm" onPress={onMarkRead} disabled={isMarking}>
                {markReadLabel}
              </Button>
            ) : actionable ? (
              <View style={styles.openIndicator} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="chevron-right" size={18} color={semanticColors.action.primaryBg} />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );

  const accentStyle = read
    ? styles.accentRead
    : emphasis === 'warning' || importantLabel != null
      ? styles.accentWarning
      : categoryTone === 'info'
        ? styles.accentInfo
        : categoryTone === 'success'
          ? styles.accentSuccess
          : styles.accentUnread;
  const surfaceStyle = !read && categoryTone === 'info' ? styles.cardInfo : null;
  const quietStyle = read && !actionable ? styles.cardQuiet : null;

  if (actionable) {
    return (
      <Card
        interactive
        onPress={onActivate}
        accessibilityLabel={title}
        accessibilityState={{ busy: Boolean(isMarking), selected: !read }}
        style={[styles.card, isWide && styles.cardWide, surfaceStyle, accentStyle, quietStyle]}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card style={[styles.card, isWide && styles.cardWide, surfaceStyle, accentStyle, quietStyle]}>
      {content}
    </Card>
  );
}

const UNREAD_DOT_SIZE = 6;

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    borderLeftWidth: 5,
  },
  cardWide: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardQuiet: {
    borderColor: semanticColors.border.soft,
  },
  cardInfo: {
    backgroundColor: semanticColors.surface.sunken,
  },
  accentUnread: {
    borderColor: semanticColors.border.default,
    borderLeftColor: semanticColors.text.primary,
  },
  accentWarning: {
    borderColor: semanticColors.border.default,
    borderLeftColor: semanticColors.status.warningFg,
  },
  accentInfo: {
    borderColor: semanticColors.border.default,
    borderLeftColor: semanticColors.action.primaryBg,
  },
  accentSuccess: {
    borderColor: semanticColors.border.default,
    borderLeftColor: semanticColors.status.successFg,
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
    fontFamily: typography.mono.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    borderRadius: 9999,
    backgroundColor: semanticColors.status.infoBg,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
  },
  unreadPillOnTint: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
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
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    borderRadius: 9999,
    backgroundColor: semanticColors.status.warningBg,
    borderWidth: 1,
    borderColor: semanticColors.status.warningBg,
  },
  importantText: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.status.warningFg,
  },

  /* ---- body ---- */
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 24,
    color: semanticColors.text.primary,
  },
  titleWide: {
    fontSize: 20,
    lineHeight: 27,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
    maxWidth: 640,
  },
  descriptionWide: {
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 900,
  },

  /* ---- footer ---- */
  footerSection: {
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
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
  footerRowWide: {
    minHeight: 36,
  },
  caseLine: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
    flexShrink: 1,
  },
  openIndicator: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
  },

  /* ---- misc ---- */
  errorText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12,
    color: semanticColors.status.errorFg,
  },
});
