import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';

export type SurfaceLevel = keyof typeof semanticColors.surface;

export type SurfaceProps = Omit<ViewProps, 'style'> & {
  /** Background level — see semanticColors.surface. Defaults to 'card'. */
  level?: SurfaceLevel;
  /** Adds the default hairline border (never a shadow — see tokens/elevation.ts). */
  bordered?: boolean;
  rounded?: keyof typeof radii;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Generic background primitive for non-`Card` containers (screen headers,
 * sidebars, sunken groups) that today re-declare `semanticColors.surface.*`
 * inline. Deliberately has no press/interactive behavior and no shadow —
 * `Card` remains the primitive for interactive/bordered content blocks.
 */
export function Surface({ level = 'card', bordered = false, rounded, children, style, ...rest }: SurfaceProps) {
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: semanticColors.surface[level] },
        bordered ? { borderWidth: 1, borderColor: semanticColors.border.default } : null,
        rounded ? { borderRadius: radii[rounded] } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
