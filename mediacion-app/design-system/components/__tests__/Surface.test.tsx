import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { semanticColors } from '../../tokens/colors';
import { radii } from '../../tokens/radii';
import { Surface } from '../Surface';

describe('Surface', () => {
  it('renders children', async () => {
    await render(
      <Surface>
        <Text>content</Text>
      </Surface>,
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('defaults to the card surface level', async () => {
    await render(
      <Surface testID="surface">
        <Text>x</Text>
      </Surface>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('surface').props.style);
    expect(flat).toMatchObject({ backgroundColor: semanticColors.surface.card });
  });

  it('applies the requested surface level', async () => {
    await render(
      <Surface level="sunken" testID="surface">
        <Text>x</Text>
      </Surface>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('surface').props.style);
    expect(flat).toMatchObject({ backgroundColor: semanticColors.surface.sunken });
  });

  it('adds a hairline border when bordered', async () => {
    await render(
      <Surface bordered testID="surface">
        <Text>x</Text>
      </Surface>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('surface').props.style);
    expect(flat).toMatchObject({ borderWidth: 1, borderColor: semanticColors.border.default });
  });

  it('applies a radius token when requested', async () => {
    await render(
      <Surface rounded="lg" testID="surface">
        <Text>x</Text>
      </Surface>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('surface').props.style);
    expect(flat).toMatchObject({ borderRadius: radii.lg });
  });
});
