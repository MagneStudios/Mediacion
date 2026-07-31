import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { semanticColors } from '../../tokens/colors';
import { typography } from '../../tokens/typography';
import { Text } from '../Text';

describe('Text', () => {
  it('renders children', async () => {
    await render(<Text>Hola</Text>);
    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it('defaults to the body variant and primary color', async () => {
    await render(<Text>Body copy</Text>);
    const flat = StyleSheet.flatten(screen.getByText('Body copy').props.style);
    expect(flat).toMatchObject({ fontSize: typography.body.fontSize, color: semanticColors.text.primary });
  });

  it('applies the requested typography variant', async () => {
    await render(<Text variant="headline">Title</Text>);
    const flat = StyleSheet.flatten(screen.getByText('Title').props.style);
    expect(flat).toMatchObject({ fontSize: typography.headline.fontSize, fontFamily: typography.headline.fontFamily });
  });

  it('applies the requested semantic color', async () => {
    await render(<Text color="secondary">Muted</Text>);
    const flat = StyleSheet.flatten(screen.getByText('Muted').props.style);
    expect(flat).toMatchObject({ color: semanticColors.text.secondary });
  });

  it('merges a caller-provided style on top of the token style', async () => {
    await render(<Text style={{ textAlign: 'center' }}>Centered</Text>);
    const flat = StyleSheet.flatten(screen.getByText('Centered').props.style);
    expect(flat).toMatchObject({ textAlign: 'center', color: semanticColors.text.primary });
  });
});
