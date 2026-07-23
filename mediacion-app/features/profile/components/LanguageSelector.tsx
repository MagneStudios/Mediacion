import { StyleSheet, View } from 'react-native';

import { SelectableCard } from '../../../design-system/components/SelectableCard';
import { spacing } from '../../../design-system/tokens/spacing';
import type { PreferredLanguage } from '../../../types/profile';

export type LanguageSelectorProps = {
  value: PreferredLanguage;
  onChange: (next: PreferredLanguage) => void;
  esLabel: string;
  esDescription: string;
  enLabel: string;
  enDescription: string;
  selectedLabel: string;
  disabled?: boolean;
};

/** Two SelectableCards — 'es' and 'en' — mirroring the case-creation method picker rather than introducing a new control. */
export function LanguageSelector({
  value,
  onChange,
  esLabel,
  esDescription,
  enLabel,
  enDescription,
  selectedLabel,
  disabled = false,
}: LanguageSelectorProps) {
  return (
    <View style={styles.column}>
      <SelectableCard
        icon="globe"
        title={esLabel}
        description={esDescription}
        selected={value === 'es'}
        selectedLabel={selectedLabel}
        onPress={() => !disabled && onChange('es')}
      />
      <SelectableCard
        icon="globe"
        title={enLabel}
        description={enDescription}
        selected={value === 'en'}
        selectedLabel={selectedLabel}
        onPress={() => !disabled && onChange('en')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.sm,
  },
});
