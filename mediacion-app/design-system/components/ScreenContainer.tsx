import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '../../hooks/use-responsive-layout';
import { semanticColors } from '../tokens/colors';
import { contentWidths, type ContentWidthToken } from '../tokens/layout';

export type ScreenContainerProps = {
  children: ReactNode;
  /** Named content max-width — defaults to 'standard'. See design-system/tokens/layout.ts. */
  widthToken?: ContentWidthToken;
  style?: StyleProp<ViewStyle>;
  /** Vertically centers content — for short, standalone screens (e.g. signed-out). */
  centerVertically?: boolean;
};

/**
 * Plain-`View` screen wrapper — canvas background, horizontally centered
 * column capped at a named content width, responsive horizontal padding.
 *
 * Deliberately never wraps a `ScrollView`/`FlatList` — screens that scroll
 * use `getResponsiveContentStyle()` (design-system/tokens/layout.ts)
 * directly on their own `contentContainerStyle` instead, so there is never
 * a second nested scroll container anywhere in the app.
 */
export function ScreenContainer({ children, widthToken = 'standard', style, centerVertically = false }: ScreenContainerProps) {
  const { horizontalPadding } = useResponsiveLayout();

  return (
    <View style={[styles.outer, centerVertically ? styles.centerVertically : null]}>
      <View style={[styles.inner, { maxWidth: contentWidths[widthToken], paddingHorizontal: horizontalPadding }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
    alignItems: 'center',
  },
  centerVertically: {
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
  },
});
