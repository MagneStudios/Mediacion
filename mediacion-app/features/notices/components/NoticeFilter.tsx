import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { NoticeFilter as NoticeFilterValue } from '../../../types/notice';

// Same self-contained focus-visible injection as Button/CaseFilters — a CSS
// pseudo-class, not a JS event, so it costs nothing on native (no-op there).
if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'notice-filter-focus-visible');
    styleTag.textContent =
      `[data-testid="notice-filter-tab"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser — safe no-op */
  }
}

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
      <FilterTab label={allLabel} selected={value === 'all'} onPress={() => onChange('all')} isWide={isWide} />
      <FilterTab label={unreadLabel} selected={value === 'unread'} onPress={() => onChange('unread')} isWide={isWide} />
    </View>
  );
}

type FilterTabProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  isWide: boolean;
};

function FilterTab({ label, selected, onPress, isWide }: FilterTabProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID="notice-filter-tab"
      style={({ hovered, pressed }) => [
        styles.tab,
        isWide && styles.tabWide,
        selected && styles.tabActive,
        isWide && selected && styles.tabActiveWide,
        !selected && hovered && (isWide ? styles.tabHoverWide : styles.tabHover),
        pressed && styles.tabPressed,
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelActive : styles.labelInactive]}>{label}</Text>
    </Pressable>
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
  tabHover: {
    borderBottomColor: semanticColors.border.default,
  },
  tabHoverWide: {
    backgroundColor: 'rgba(23, 50, 74, 0.05)',
  },
  tabPressed: {
    opacity: 0.7,
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
