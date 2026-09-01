import { Platform } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '../tokens/colors';

/**
 * `react-native-svg` renders a real `<svg>` on web and forwards whatever props
 * it does not recognise straight to that DOM node — it does **not** translate
 * React Native's accessibility props the way `react-native-web` does for
 * ordinary components. Passing `accessibilityElementsHidden` there produced an
 * `importantForAccessibility="no-hide-descendants"` attribute in the DOM (not a
 * thing) and left the mark *visible* to the accessibility tree, which is the
 * opposite of what was asked for. Confirmed in the browser, not assumed.
 *
 * So each platform gets the props it actually honours.
 *
 * Takes the platform as an argument rather than reading `Platform.OS` itself so
 * both branches are reachable from one test file — under jest-expo the platform
 * is fixed per run, and mocking it out is more machinery than this deserves.
 */
export function logoAccessibilityProps(platform: typeof Platform.OS, label: string | undefined) {
  const decorative = label === undefined;
  if (platform === 'web') {
    return decorative ? { 'aria-hidden': true } : { role: 'img' as const, 'aria-label': label };
  }
  return decorative
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
    : { accessibilityRole: 'image' as const, accessibilityLabel: label };
}

export type LogoProps = {
  /** Rendered square size in px. Defaults to 40. See the note on 32px below. */
  size?: number;
  /**
   * Stroke color. Defaults to `colors.primary` so the mark stays inside the
   * app's palette wherever it appears in-product.
   */
  color?: string;
  /**
   * When set, the mark is exposed as an image with this label. Omitted, it is
   * hidden from the accessibility tree — which is the common case, because a
   * logo almost always sits next to the product name in text, and announcing
   * both reads it twice.
   *
   * Deliberately has no default: the product name is still undefined
   * (`app.json` says `mediacion-app`, the brand pack says "refugio", the
   * client says "Pactum"), and a component is the wrong place to guess it.
   */
  accessibilityLabel?: string;
};

/**
 * The brand mark: four figures — two adults, two minors — inside a rounded
 * container. Traced from `svg/refugio-oscuro.svg` of the brand pack the client
 * approved on 01/09/2026 (`docs/respuestas-cliente-01-09-2026.md` §6), keeping
 * its geometry exactly: `viewBox 12 12 236 236`, uniform 7-unit stroke, round
 * caps and joins.
 *
 * **Stroke only, no fill.** The pack's own note for developers asks for
 * `currentColor` so one file serves both themes; the React Native equivalent
 * is this `color` prop, since RN has no inherited CSS color to resolve against.
 *
 * **The color defaults to a token, not to the pack's `#2E6E8E`.** In-product,
 * the mark is one more element of the interface and should not introduce a
 * second blue next to `colors.primary` (`#3F6F9E`). The pack's hex is used
 * where the mark is genuinely brand and not interface — the app icon and the
 * splash, which are baked PNGs. It is a small difference and it is deliberate;
 * if whoever owns the palette prefers the pack's blue everywhere, the change
 * is this default plus the two token values.
 *
 * **Do not render below 32px.** The pack is explicit, and it checks out: at
 * 16px the middle figures' legs merge into a solid block and the mark reads as
 * a filled square. The favicon is generated at 48px for that reason.
 */
export function Logo({ size = 40, color = colors.primary, accessibilityLabel }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="12 12 236 236"
      {...logoAccessibilityProps(Platform.OS, accessibilityLabel)}
    >
      <G fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={16} y={16} width={228} height={228} rx={60} />
        {/* Adults: head r17, shoulders r24. */}
        <Circle cx={72} cy={75} r={17} />
        <Path d="M48 202 L48 122 A24 24 0 0 1 96 122" />
        <Circle cx={188} cy={75} r={17} />
        <Path d="M212 202 L212 122 A24 24 0 0 0 164 122" />
        {/* Minors: head r12, shoulders r14. */}
        <Circle cx={110} cy={126} r={12} />
        <Path d="M96 202 L96 157 A14 14 0 0 1 124 157 L124 202" />
        <Circle cx={150} cy={126} r={12} />
        <Path d="M164 202 L164 157 A14 14 0 0 0 136 157 L136 202" />
      </G>
    </Svg>
  );
}
