import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { semanticColors } from '../../tokens/colors';
import { Divider } from '../Divider';

// Divider is intentionally hidden from the accessibility tree
// (accessibilityElementsHidden), so every query below opts into
// includeHiddenElements — otherwise React Native Testing Library excludes it
// by default, per its "hidden" query option.
const hidden = { includeHiddenElements: true };

describe('Divider', () => {
  it('renders with a testID', async () => {
    await render(<Divider testID="divider" />);
    expect(screen.getByTestId('divider', hidden)).toBeTruthy();
  });

  it('is hidden from the accessibility tree', async () => {
    await render(<Divider testID="divider" />);
    const node = screen.getByTestId('divider', hidden);
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('defaults to a full-width horizontal line using the default border tone', async () => {
    await render(<Divider testID="divider" />);
    const flat = StyleSheet.flatten(screen.getByTestId('divider', hidden).props.style);
    expect(flat).toMatchObject({ height: 1, width: '100%', backgroundColor: semanticColors.border.default });
  });

  it('renders a vertical line when requested', async () => {
    await render(<Divider testID="divider" orientation="vertical" />);
    const flat = StyleSheet.flatten(screen.getByTestId('divider', hidden).props.style);
    expect(flat).toMatchObject({ width: 1, height: '100%' });
  });

  it('uses the soft border tone when requested', async () => {
    await render(<Divider testID="divider" tone="soft" />);
    const flat = StyleSheet.flatten(screen.getByTestId('divider', hidden).props.style);
    expect(flat).toMatchObject({ backgroundColor: semanticColors.border.soft });
  });
});
