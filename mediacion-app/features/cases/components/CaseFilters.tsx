import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { MetodoCaso } from '../../../types/case';

/** 'all' plus the three real, backend-aligned resolution methods — never a category Stitch invented. */
export type CaseFilterValue = 'all' | MetodoCaso;

export type CaseFiltersProps = {
  value: CaseFilterValue;
  onChange: (next: CaseFilterValue) => void;
  allLabel: string;
  methodLabels: Record<MetodoCaso, string>;
};

const METHODS: MetodoCaso[] = ['negociacion', 'conciliacion', 'mediacion'];

/**
 * Client-side filter over the already-fetched case list — same pattern as
 * `NoticeFilter` in the Avisos tab (no service/hook change, just a derived
 * view of data already in memory). Horizontally scrollable so it never
 * overflows on narrow widths (320px) regardless of locale text length.
 */
export function CaseFilters({ value, onChange, allLabel, methodLabels }: CaseFiltersProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.row}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'all' }}
        onPress={() => onChange('all')}
        style={[styles.chip, value === 'all' ? styles.chipActive : null]}
      >
        <Text style={[styles.label, value === 'all' ? styles.labelActive : null]}>{allLabel}</Text>
      </Pressable>
      {METHODS.map((metodo) => (
        <Pressable
          key={metodo}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === metodo }}
          onPress={() => onChange(metodo)}
          style={[styles.chip, value === metodo ? styles.chipActive : null]}
        >
          <Text style={[styles.label, value === metodo ? styles.labelActive : null]}>{methodLabels[metodo]}</Text>
        </Pressable>
      ))}
    </ScrollView>
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
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.sunken,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
  },
  chipActive: {
    backgroundColor: semanticColors.action.primaryBg,
    borderColor: semanticColors.action.primaryBg,
  },
  label: {
    fontFamily: typography.button.fontFamily,
    fontSize: 13,
    color: semanticColors.text.secondary,
  },
  labelActive: {
    color: semanticColors.action.primaryFg,
  },
});
