import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { semanticColors } from '../tokens/colors';

export type DividerProps = Omit<ViewProps, 'style'> & {
  orientation?: 'horizontal' | 'vertical';
  /** 'default' (visible) or 'soft' (quieter) — see semanticColors.border. Defaults to 'default'. */
  tone?: 'default' | 'soft';
  style?: StyleProp<ViewStyle>;
};

/**
 * Hairline separator. Purely decorative — hidden from the accessibility
 * tree, matching how every other purely-visual divider in this app is
 * already treated (e.g. EntityTypeIndicator).
 */
export function Divider({ orientation = 'horizontal', tone = 'default', style, ...rest }: DividerProps) {
  const color = tone === 'soft' ? semanticColors.border.soft : semanticColors.border.default;
  return (
    <View
      {...rest}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        orientation === 'horizontal' ? { height: 1, width: '100%' } : { width: 1, height: '100%' },
        { backgroundColor: color },
        style,
      ]}
    />
  );
}
