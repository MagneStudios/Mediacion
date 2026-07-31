import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

// Keyboard focus-visible ring for web — same pattern as Button. CSS pseudo-class,
// not a JS event. Injects once at module scope; `outline` draws outside the
// border box so layout/spacing is unaffected. Native is a no-op.
if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'case-filter-focus-visible');
    styleTag.textContent =
      `[data-testid="case-filter-chip"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser — safe no-op */
  }
}

/**
 * Client-side filter over the already-fetched case list — same pattern as
 * `NoticeFilter` in the Avisos tab (no service/hook change, just a derived
 * view of data already in memory). Horizontally scrollable so it never
 * overflows on narrow widths (320px) regardless of locale text length.
 *
 * Visual: chips live inside a single grouped surface (soft aquatic sunken
 * background + hairline border). The selected chip is a white pill with a
 * visible primary border, never the solid primary fill — so the filter
 * never competes with the main "Crear un caso" CTA. Touch targets stay
 * at the 44px minimum on every breakpoint via the chip's own minHeight.
 */
export function CaseFilters({ value, onChange, allLabel, methodLabels }: CaseFiltersProps) {
  return (
    <View style={styles.surface}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.row}
      >
        <FilterChip label={allLabel} selected={value === 'all'} onPress={() => onChange('all')} />
        {METHODS.map((metodo) => (
          <FilterChip
            key={metodo}
            label={methodLabels[metodo]}
            selected={value === metodo}
            onPress={() => onChange(metodo)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID="case-filter-chip"
      style={({ hovered, pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        !selected && hovered ? styles.chipHover : null,
        pressed ? styles.chipPressed : null,
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    paddingVertical: 2,
    paddingHorizontal: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingRight: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.action.primaryBg,
  },
  chipHover: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
  },
  chipPressed: {
    backgroundColor: semanticColors.surface.card,
    opacity: 0.85,
  },
  label: {
    fontFamily: typography.button.fontFamily,
    fontSize: 13,
  },
  labelUnselected: {
    color: semanticColors.text.secondary,
  },
  labelSelected: {
    color: semanticColors.text.primary,
    fontWeight: '600',
  },
});
