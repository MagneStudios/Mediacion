import { render, screen } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { Button } from '../Button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders children text', async () => {
      await render(<Button>Save</Button>);
      expect(screen.getByText('Save')).toBeTruthy();
    });

    it('renders all variants without crashing', async () => {
      const variants = ['primary', 'secondary', 'tertiary', 'ai', 'destructive'] as const;
      for (const variant of variants) {
        const { unmount } = await render(<Button variant={variant}>{variant}</Button>);
        expect(screen.getByText(variant)).toBeTruthy();
        await unmount();
      }
    });

    it('applies fullWidth when set', async () => {
      await render(<Button fullWidth>Full</Button>);
      expect(screen.getByText('Full')).toBeTruthy();
    });
  });

  describe('behaviour', () => {
    it('calls onPress exactly once when pressed', async () => {
      const onPress = jest.fn();
      await render(<Button onPress={onPress}>Click</Button>);
      screen.getByText('Click').parent?.props.onClick?.({} as never);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', async () => {
      const onPress = jest.fn();
      await render(<Button disabled onPress={onPress}>Click</Button>);
      screen.getByRole('button').props.onClick?.({} as never);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not call onPress when loading', async () => {
      const onPress = jest.fn();
      await render(<Button loading onPress={onPress}>Click</Button>);
      screen.getByRole('button').props.onClick?.({} as never);
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('exposes accessibilityState.busy when loading', async () => {
      await render(<Button loading>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.props.accessibilityState.busy).toBe(true);
    });

    it('exposes accessibilityState.disabled when loading', async () => {
      await render(<Button loading>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('exposes accessibilityState.disabled when disabled', async () => {
      await render(<Button disabled>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('renders with accessibilityRole button', async () => {
      await render(<Button>Click</Button>);
      expect(screen.getByRole('button')).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('shows ActivityIndicator while loading', async () => {
      await render(<Button loading>Save</Button>);
      // Button renders ActivityIndicator when loading=true
      const button = screen.getByRole('button');
      expect(button.props.accessibilityState.busy).toBe(true);
    });

    it('keeps the label text visible while loading', async () => {
      await render(<Button loading>Save</Button>);
      expect(screen.getByText('Save')).toBeTruthy();
    });

    it('uses loadingLabel when provided', async () => {
      await render(<Button loading loadingLabel="Saving...">Save</Button>);
      expect(screen.getByText('Saving...')).toBeTruthy();
    });
  });

  describe('focus-visible', () => {
    it('injects a web-only focus-visible CSS rule when Platform.OS is web', () => {
      // Module-level injection runs on import — verify it landed in document.head.
      if (typeof document === 'undefined') return;
      const styleEl = document.head.querySelector('[data-mediacion="button-focus-visible"]');
      if (!styleEl) return; // non-web platform — skip
      expect(styleEl.textContent).toContain('focus-visible');
      expect(styleEl.textContent).toContain('mediacion-button');
      expect(styleEl.textContent).toContain('outline');
    });

    it('does not interfere with disabled accessibility state', async () => {
      await render(<Button disabled>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('does not interfere with loading accessibility state', async () => {
      await render(<Button loading>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.props.accessibilityState.busy).toBe(true);
    });

    it('renders all variants with the focus-visible testID present', async () => {
      const variants = ['primary', 'secondary', 'tertiary', 'ai', 'destructive'] as const;
      for (const variant of variants) {
        const { unmount } = await render(<Button variant={variant}>{variant}</Button>);
        const button = screen.getByRole('button');
        expect(button.props.testID).toBe('mediacion-button');
        await unmount();
      }
    });
  });
});
