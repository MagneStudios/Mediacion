import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { semanticColors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

export type InlineWarningProps = {
  children: ReactNode;
};

/**
 * Aviso en línea, no bloqueante, para texto que podría no ser adecuado para
 * compartir con la otra parte (moderación de lenguaje, placeholder FE-only).
 *
 * `accessibilityRole="alert"` para que los lectores de pantalla lo anuncien;
 * el color nunca es el único portador del significado — hay ícono + texto.
 */
export function InlineWarning({ children }: InlineWarningProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Icon name="alert-circle" size={16} color={semanticColors.status.warningFg} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: semanticColors.status.warningBg,
    borderRadius: 12,
    padding: spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.status.warningFg,
  },
});
