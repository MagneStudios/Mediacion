import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '../../../hooks/use-responsive-layout';
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

if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'case-filter-focus-visible');
    styleTag.textContent =
      `[data-testid="case-filter-chip"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser */
  }
}

/**
 * Client-side filter — Stitch v6 style: compact pills, solid selected,
 * soft ring unselected. Desktop keeps a single scrollable row. Compact/mobile
 * renders a fixed 2×2 grid instead — natural content-based wrapping put three
 * chips on row one and stranded the fourth alone on row two, which read as
 * unbalanced. A `width` percentage per chip (not `flex: 1`, which redistributes
 * unevenly once wrapped) forces exactly two per row regardless of label length.
 */
export function CaseFilters({ value, onChange, allLabel, methodLabels }: CaseFiltersProps) {
  const { isCompact } = useResponsiveLayout();

  const chips = (
    <>
      <FilterChip label={allLabel} selected={value === 'all'} onPress={() => onChange('all')} compact={isCompact} />
      {METHODS.map((metodo) => (
        <FilterChip
          key={metodo}
          label={methodLabels[metodo]}
          selected={value === metodo}
          onPress={() => onChange(metodo)}
          compact={isCompact}
        />
      ))}
    </>
  );

  if (isCompact) {
    return (
      <View style={styles.rowCompact} accessibilityRole="tablist">
        {chips}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={styles.row}
    >
      {chips}
    </ScrollView>
  );
}

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact: boolean;
};

function FilterChip({ label, selected, onPress, compact }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID="case-filter-chip"
      style={({ hovered, pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        selected ? styles.chipSelected : styles.chipUnselected,
        !selected && hovered ? styles.chipHover : null,
        pressed ? styles.chipPressed : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          selected ? styles.labelSelected : styles.labelUnselected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    // `justifyContent: 'space-between'` applies per wrapped line, so each
    // row of 2 fixed-width chips gets the same horizontal gap between them
    // as the next row — no `gap`/margin bookkeeping needed for that axis.
    justifyContent: 'space-between',
    rowGap: spacing.xs,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipCompact: {
    // Fixed at 48% of the row so exactly 2 chips fit per line no matter
    // which 2 land together — the leftover ~4% is the gap `space-between`
    // (on the container) places between them. Content stays centered
    // (`chip.justifyContent`/`alignItems: 'center'`) inside the wider pill.
    width: '48%',
    paddingHorizontal: spacing.xs,
    minHeight: 36,
  },
  chipUnselected: {
    backgroundColor: semanticColors.surface.sunken,
    borderColor: semanticColors.border.soft,
  },
  chipSelected: {
    backgroundColor: semanticColors.action.primaryBg,
    borderColor: semanticColors.action.primaryBg,
  },
  chipHover: {
    backgroundColor: semanticColors.surface.sunken,
  },
  chipPressed: {
    opacity: 0.85,
  },
  label: {
    fontFamily: typography.button.fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 12,
  },
  labelUnselected: {
    color: semanticColors.text.secondary,
  },
  labelSelected: {
    color: semanticColors.action.primaryFg,
    fontWeight: '600',
  },
});
