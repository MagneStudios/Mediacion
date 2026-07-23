import { Pressable, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { NoticeFilter as NoticeFilterValue } from '../../../types/notice';

export type NoticeFilterProps = {
  value: NoticeFilterValue;
  onChange: (next: NoticeFilterValue) => void;
  allLabel: string;
  unreadLabel: string;
};

/** Two sibling filter chips — neither is nested inside the other, both are plain Pressables in a plain row. */
export function NoticeFilter({ value, onChange, allLabel, unreadLabel }: NoticeFilterProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'all' }}
        onPress={() => onChange('all')}
        style={[styles.chip, value === 'all' ? styles.chipActive : null]}
      >
        <Text style={[styles.label, value === 'all' ? styles.labelActive : null]}>{allLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'unread' }}
        onPress={() => onChange('unread')}
        style={[styles.chip, value === 'unread' ? styles.chipActive : null]}
      >
        <Text style={[styles.label, value === 'unread' ? styles.labelActive : null]}>{unreadLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: semanticColors.surface.sunken,
  },
  chipActive: {
    backgroundColor: semanticColors.text.primary,
  },
  label: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.secondary,
  },
  labelActive: {
    color: semanticColors.text.onPrimary,
  },
});
