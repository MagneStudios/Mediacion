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
  isWide?: boolean;
};

export function NoticeFilter({ value, onChange, allLabel, unreadLabel, isWide = false }: NoticeFilterProps) {
  return (
    <View style={[styles.row, isWide && styles.rowWide]} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'all' }}
        onPress={() => onChange('all')}
        style={[styles.tab, isWide && styles.tabWide, value === 'all' && styles.tabActive, isWide && value === 'all' && styles.tabActiveWide]}
      >
        <Text style={[styles.label, value === 'all' ? styles.labelActive : styles.labelInactive]}>{allLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'unread' }}
        onPress={() => onChange('unread')}
        style={[styles.tab, isWide && styles.tabWide, value === 'unread' && styles.tabActive, isWide && value === 'unread' && styles.tabActiveWide]}
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
  rowWide: {
    gap: spacing.xxs,
    padding: spacing.xxs,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.sunken,
  },
  tab: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabWide: {
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0,
    borderRadius: radii.pill,
  },
  tabActive: {
    borderBottomColor: semanticColors.text.primary,
  },
  tabActiveWide: {
    backgroundColor: semanticColors.surface.card,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
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
