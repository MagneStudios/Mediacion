// Covers the "responsive container" primitive requirement for the redesign
// foundations phase. No separate `ResponsiveContainer` component was created
// — `ScreenContainer` (non-scrolling screens) plus `getResponsiveContentStyle`
// (design-system/tokens/layout.ts, for scrollable screens) already cover that
// role end to end; adding a third wrapper would duplicate the existing theme
// layer instead of reusing it.
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
}));

import { contentWidths } from '../../tokens/layout';
import { ScreenContainer } from '../ScreenContainer';

describe('ScreenContainer', () => {
  it('renders children', async () => {
    await render(
      <ScreenContainer>
        <Text>content</Text>
      </ScreenContainer>,
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('defaults to the standard content width', async () => {
    await render(
      <ScreenContainer>
        <Text testID="inner">x</Text>
      </ScreenContainer>,
    );
    // Traverse up to the width-capped inner View.
    const inner = screen.getByTestId('inner').parent;
    expect(inner?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ maxWidth: contentWidths.standard })]),
    );
  });

  it('accepts an alternate width token', async () => {
    await render(
      <ScreenContainer widthToken="form">
        <Text testID="inner">x</Text>
      </ScreenContainer>,
    );
    const inner = screen.getByTestId('inner').parent;
    expect(inner?.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ maxWidth: contentWidths.form })]));
  });
});
