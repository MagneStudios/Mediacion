import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { typography, type TypographyRole } from '../tokens/typography';

export type TextTone = keyof typeof semanticColors.text;

export type TextProps = Omit<RNTextProps, 'style'> & {
  /** Typography role — see design-system/tokens/typography.ts. Defaults to 'body'. */
  variant?: TypographyRole;
  /** Semantic text color — see semanticColors.text. Defaults to 'primary'. */
  color?: TextTone;
  style?: StyleProp<TextStyle>;
};

/**
 * Thin typography primitive — every screen already renders plain RN `Text`
 * with inline typography-token styles; this exists so new work can reach
 * for one import instead of re-deriving `{ fontFamily, fontSize, lineHeight,
 * letterSpacing, color }` by hand. Purely presentational: no domain logic,
 * no screen ever required to migrate to it in this phase.
 */
export function Text({ variant = 'body', color = 'primary', style, children, ...rest }: TextProps) {
  const role = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: role.fontFamily,
          fontSize: role.fontSize,
          lineHeight: role.lineHeight,
          letterSpacing: role.letterSpacing,
          color: semanticColors.text[color],
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
