import { render, screen } from '@testing-library/react-native';

import { colors } from '../../tokens/colors';
import { Logo, logoAccessibilityProps } from '../Logo';

// `react-native-svg` is mapped to test-helpers/mocks/svg-mock.ts, which renders
// each element as a View carrying its props through — so the assertions below
// read the props the component actually passed, not a rasterized result.
// Without a label the mark is hidden from the accessibility tree, so queries
// opt into hidden elements the same way Divider's tests do.
const hidden = { includeHiddenElements: true };

describe('Logo', () => {
  it('keeps the brand pack geometry: the viewBox is the mark, not a crop of it', async () => {
    await render(<Logo />);
    expect(screen.getByTestId('svg-Svg', hidden).props.viewBox).toBe('12 12 236 236');
  });

  it('draws the container plus four figures — two adults and two minors', async () => {
    await render(<Logo />);
    expect(screen.getAllByTestId('svg-Rect', hidden)).toHaveLength(1);
    // One head each, and one body path each.
    expect(screen.getAllByTestId('svg-Circle', hidden)).toHaveLength(4);
    expect(screen.getAllByTestId('svg-Path', hidden)).toHaveLength(4);
  });

  it('is stroke-only at the pack\'s uniform 7 units, with round caps and joins', async () => {
    await render(<Logo />);
    expect(screen.getByTestId('svg-G', hidden).props).toMatchObject({
      fill: 'none',
      strokeWidth: 7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    });
  });

  it('defaults to the palette token, so the mark does not introduce a second blue', async () => {
    await render(<Logo />);
    expect(screen.getByTestId('svg-G', hidden).props.stroke).toBe(colors.primary);
  });

  it('takes the color it is given — this is the RN stand-in for currentColor', async () => {
    await render(<Logo color="#FFFFFF" />);
    expect(screen.getByTestId('svg-G', hidden).props.stroke).toBe('#FFFFFF');
  });

  it('is decorative by default: a logo beside the product name should not be announced twice', async () => {
    await render(<Logo />);
    const svg = screen.getByTestId('svg-Svg', hidden);
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(svg.props.accessibilityRole).toBeUndefined();
  });

  it('becomes an announced image once it is given a label', async () => {
    await render(<Logo accessibilityLabel="Pactum" />);
    const svg = screen.getByTestId('svg-Svg', hidden);
    expect(svg.props).toMatchObject({ accessibilityRole: 'image', accessibilityLabel: 'Pactum' });
    expect(svg.props.accessibilityElementsHidden).toBeUndefined();
  });

  it('renders square at the requested size', async () => {
    await render(<Logo size={64} />);
    expect(screen.getByTestId('svg-Svg', hidden).props).toMatchObject({ width: 64, height: 64 });
  });
});

/**
 * react-native-svg renders a real <svg> on web and forwards unrecognised props
 * straight to it instead of translating React Native's accessibility props.
 * Passing `accessibilityElementsHidden` there put a bogus
 * `importantForAccessibility` attribute in the DOM and left the mark exposed to
 * the accessibility tree — found in a browser, fixed with a platform branch,
 * pinned here so it cannot come back. Under jest-expo the platform is fixed per
 * run, so the branch is exercised through the pure function instead.
 */
describe('logoAccessibilityProps', () => {
  it('hides the decorative mark on web with the attribute the DOM honours', () => {
    expect(logoAccessibilityProps('web', undefined)).toEqual({ 'aria-hidden': true });
  });

  it('labels the mark on web as an image role', () => {
    expect(logoAccessibilityProps('web', 'Pactum')).toEqual({ role: 'img', 'aria-label': 'Pactum' });
  });

  it('never emits React Native props on web, which the DOM would ignore', () => {
    for (const label of [undefined, 'Pactum']) {
      const props = logoAccessibilityProps('web', label) as Record<string, unknown>;
      expect(props.accessibilityElementsHidden).toBeUndefined();
      expect(props.importantForAccessibility).toBeUndefined();
      expect(props.accessibilityRole).toBeUndefined();
    }
  });

  it('uses the React Native props on native, and no aria ones', () => {
    for (const platform of ['ios', 'android'] as const) {
      expect(logoAccessibilityProps(platform, undefined)).toEqual({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
      expect(logoAccessibilityProps(platform, 'Pactum')).toEqual({
        accessibilityRole: 'image',
        accessibilityLabel: 'Pactum',
      });
    }
  });
});
