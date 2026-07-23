import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Icon, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type PositionCardProps = {
  categoryLabel: string;
  name: string;
  description?: string;
  rangeLabel: string;
  concedeLabel: string;
  canConcede: boolean;
  canManage: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editAccessibilityLabel: string;
  deleteAccessibilityLabel: string;
};

/**
 * One own private position item — never shows counterparty data because
 * there is none to show here.
 *
 * The outer `Card` is non-interactive (a plain View): it never renders as a
 * button. Opening the item is one dedicated `Pressable` here, and edit/
 * delete are sibling `Pressable`s in the same row — never nested inside
 * another Pressable/button, which RN Web (correctly) rejects as invalid
 * nested `<button>` elements.
 */
export function PositionCard({
  categoryLabel,
  name,
  description,
  rangeLabel,
  concedeLabel,
  canConcede,
  canManage,
  onPress,
  onEdit,
  onDelete,
  editAccessibilityLabel,
  deleteAccessibilityLabel,
}: PositionCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={name}
          style={styles.primaryPressable}
        >
          <View style={styles.headerText}>
            <Text style={styles.category}>{categoryLabel}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>

          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <StatusPill status="neutral">{rangeLabel}</StatusPill>
            <StatusPill status={canConcede ? 'success' : 'neutral'}>{concedeLabel}</StatusPill>
          </View>
        </Pressable>

        {canManage ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={editAccessibilityLabel}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Icon name="pencil" size={17} color={semanticColors.text.secondary} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={deleteAccessibilityLabel}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Icon name="trash-2" size={17} color={semanticColors.status.errorFg} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  primaryPressable: {
    flex: 1,
    gap: spacing.xs,
  },
  headerText: {
    gap: 2,
  },
  category: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  name: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
