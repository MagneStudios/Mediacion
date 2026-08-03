import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders children text', async () => {
    await render(<Badge>Nuevo</Badge>);
    expect(screen.getByText('Nuevo')).toBeTruthy();
  });

  it('renders every variant without crashing', async () => {
    const variants = ['neutral', 'solid', 'outline', 'ai'] as const;
    for (const variant of variants) {
      const { unmount } = await render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeTruthy();
      await unmount();
    }
  });

  it('renders both sizes without crashing', async () => {
    const sizes = ['md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = await render(<Badge size={size}>{size}</Badge>);
      expect(screen.getByText(size)).toBeTruthy();
      await unmount();
    }
  });

  it('renders an optional leading icon', async () => {
    await render(<Badge iconLeft={<Text>icon</Text>}>With icon</Badge>);
    expect(screen.getByText('icon')).toBeTruthy();
    expect(screen.getByText('With icon')).toBeTruthy();
  });
});
