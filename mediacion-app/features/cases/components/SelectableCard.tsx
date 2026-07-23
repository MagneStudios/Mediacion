import { StyleSheet, Text, View } from 'react-native';

import { Card, Icon, type IconName } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type SelectableCardProps = {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  selectedLabel: string;
  onPress: () => void;
};

/**
 * Single-select option card shared by the resolution-method step and the
 * invitation-method step — same shape (icon + title + description + a
 * selected state that never relies on color alone), so one primitive covers
 * both rather than two near-duplicate components.
 */
export function SelectableCard({ icon, title, description, selected, selectedLabel, onPress }: SelectableCardProps) {
  return (
    <Card
      interactive
      onPress={onPress}
      accessibilityLabel={title}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.card, selected ? styles.cardSelected : null]}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, selected ? styles.iconCircleSelected : null]}>
          <Icon name={icon} size={20} color={selected ? semanticColors.text.onPrimary : semanticColors.text.tertiary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {selected ? (
            <View style={styles.selectedRow}>
              <Icon name="check" size={13} color={semanticColors.text.primary} />
              <Text style={styles.selectedText}>{selectedLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
  },
  cardSelected: {
    borderColor: semanticColors.border.strong,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  iconCircleSelected: {
    backgroundColor: semanticColors.text.primary,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  selectedText: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.primary,
  },
});
