import { Pressable, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { NoticeFilter as NoticeFilterValue } from '../../../types/notice';

export type NoticeFilterProps = {
  value: NoticeFilterValue;
  onChange: (next: NoticeFilterValue) => void;
  allLabel: string;
  unreadLabel: string;
};

export function NoticeFilter({ value, onChange, allLabel, unreadLabel }: NoticeFilterProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'all' }}
        onPress={() => onChange('all')}
        style={[styles.tab, value === 'all' && styles.tabActive]}
      >
        <Text style={[styles.label, value === 'all' ? styles.labelActive : styles.labelInactive]}>{allLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'unread' }}
        onPress={() => onChange('unread')}
        style={[styles.tab, value === 'unread' && styles.tabActive]}
      >
        <Text style={[styles.label, value === 'unread' ? styles.labelActive : styles.labelInactive]}>{unreadLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: semanticColors.border.soft,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: semanticColors.text.primary,
  },
  label: {
    fontFamily: typography.button.fontFamily,
    fontSize: 14,
    fontWeight: '500',
  },
  labelActive: {
    color: semanticColors.text.primary,
    fontWeight: '600',
  },
  labelInactive: {
    color: semanticColors.text.tertiary,
  },
});
