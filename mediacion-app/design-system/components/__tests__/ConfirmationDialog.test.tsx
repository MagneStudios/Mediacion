import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { semanticColors } from '../../tokens/colors';
import { ConfirmationDialog } from '../ConfirmationDialog';

describe('ConfirmationDialog', () => {
  const baseProps = {
    visible: true,
    title: 'Delete this item?',
    icon: 'trash-2' as const,
    confirmLabel: 'Delete',
    confirmVariant: 'destructive' as const,
    onConfirm: jest.fn(),
    cancelLabel: 'Cancel',
    onCancel: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the title and body content', async () => {
      await render(<ConfirmationDialog {...baseProps}>This cannot be undone.</ConfirmationDialog>);
      expect(screen.getByText('Delete this item?')).toBeTruthy();
      expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    });

    it('exposes the title with header semantics', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      const header = screen.getByRole('header');
      expect(header.props.children).toBe('Delete this item?');
    });

    it('renders confirm and cancel button labels', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      expect(screen.getByText('Delete')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('exposes the confirm and cancel buttons as independently queryable controls', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('hidden state', () => {
    it('renders nothing when visible is false', async () => {
      await render(
        <ConfirmationDialog {...baseProps} visible={false}>
          Body
        </ConfirmationDialog>,
      );
      expect(screen.queryByText('Delete this item?')).toBeNull();
      expect(screen.queryByText('Body')).toBeNull();
    });

    it('exposes no button controls when hidden', async () => {
      await render(
        <ConfirmationDialog {...baseProps} visible={false}>
          Body
        </ConfirmationDialog>,
      );
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryByRole('header')).toBeNull();
    });
  });

  describe('callbacks', () => {
    it('calls onConfirm when the confirm button is pressed', async () => {
      const onConfirm = jest.fn();
      await render(
        <ConfirmationDialog {...baseProps} onConfirm={onConfirm}>
          Body
        </ConfirmationDialog>,
      );
      screen.getByText('Delete').parent?.props.onClick?.({} as never);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when the cancel button is pressed', async () => {
      const onCancel = jest.fn();
      await render(
        <ConfirmationDialog {...baseProps} onCancel={onCancel}>
          Body
        </ConfirmationDialog>,
      );
      screen.getByText('Cancel').parent?.props.onClick?.({} as never);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('omits the cancel button when cancelLabel/onCancel are not provided', async () => {
      await render(
        <ConfirmationDialog {...baseProps} cancelLabel={undefined} onCancel={undefined}>
          Body
        </ConfirmationDialog>,
      );
      expect(screen.queryByText('Cancel')).toBeNull();
      expect(screen.getAllByRole('button').length).toBe(1);
    });
  });

  describe('loading state', () => {
    it('marks the confirm button busy while loading', async () => {
      await render(
        <ConfirmationDialog {...baseProps} loading>
          Body
        </ConfirmationDialog>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[0].props.accessibilityState.busy).toBe(true);
    });

    it('disables the cancel button while loading', async () => {
      await render(
        <ConfirmationDialog {...baseProps} loading>
          Body
        </ConfirmationDialog>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[1].props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('disabled confirm action', () => {
    it('disables the confirm button when disabled is set', async () => {
      await render(
        <ConfirmationDialog {...baseProps} disabled>
          Body
        </ConfirmationDialog>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[0].props.accessibilityState.disabled).toBe(true);
    });

    it('does not call onConfirm when disabled', async () => {
      const onConfirm = jest.fn();
      await render(
        <ConfirmationDialog {...baseProps} onConfirm={onConfirm} disabled>
          Body
        </ConfirmationDialog>,
      );
      screen.getByText('Delete').parent?.props.onClick?.({} as never);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('destructive variant', () => {
    it('tints the icon and its circle with the error palette when destructive is set', async () => {
      const view = await render(
        <ConfirmationDialog {...baseProps} destructive>
          Body
        </ConfirmationDialog>,
      );
      const [icon] = view.container.queryAll((instance) => instance.props.color === semanticColors.status.errorFg);
      expect(icon).toBeTruthy();

      const flatStyle = StyleSheet.flatten(icon.parent?.props.style);
      expect(flatStyle.backgroundColor).toBe(semanticColors.status.errorBg);
    });

    it('renders the neutral (non-destructive) style by default', async () => {
      const view = await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      const [icon] = view.container.queryAll((instance) => instance.props.color === semanticColors.text.secondary);
      expect(icon).toBeTruthy();

      const errorTinted = view.container.queryAll((instance) => instance.props.color === semanticColors.status.errorFg);
      expect(errorTinted).toHaveLength(0);
    });
  });

  describe('error content', () => {
    it('shows the error title instead of the actions row when errorTitle is set', async () => {
      await render(
        <ConfirmationDialog {...baseProps} errorTitle="Something went wrong" retryLabel="Retry">
          Body
        </ConfirmationDialog>,
      );
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.queryByText('Delete')).toBeNull();
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    it('retrying the error state calls onConfirm', async () => {
      const onConfirm = jest.fn();
      await render(
        <ConfirmationDialog {...baseProps} onConfirm={onConfirm} errorTitle="Something went wrong" retryLabel="Retry">
          Body
        </ConfirmationDialog>,
      );
      screen.getByText('Retry').parent?.props.onClick?.({} as never);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('renders no error content when errorTitle is absent', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      expect(screen.queryByText('Retry')).toBeNull();
    });
  });

  describe('accessibility — dialog semantics', () => {
    it('gives the dialog panel an accessible name matching the visible title', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      const panel = screen.getByTestId('mediacion-dialog-panel');
      expect(panel.props.accessibilityLabel).toBe('Delete this item?');
    });

    it('exposes the panel as an alert role', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      const panel = screen.getByTestId('mediacion-dialog-panel');
      expect(panel.props.accessibilityRole).toBe('alert');
    });

    it('carries a stable testID for web focus-trap DOM targeting', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      expect(screen.getByTestId('mediacion-dialog-panel')).toBeTruthy();
    });

    it('keeps the visible title as a separately accessible heading', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      const header = screen.getByRole('header');
      expect(header.props.children).toBe('Delete this item?');
    });

    it('keeps confirm and cancel controls as independently reachable buttons', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('presents a single-action (acknowledgement-only) dialog with one focused control', async () => {
      await render(
        <ConfirmationDialog {...baseProps} cancelLabel={undefined} onCancel={undefined}>
          Body
        </ConfirmationDialog>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByTestId('mediacion-dialog-panel')).toBeTruthy();
    });

    it('error-state retry button is independently reachable', async () => {
      await render(
        <ConfirmationDialog {...baseProps} errorTitle="Something went wrong" retryLabel="Retry">
          Body
        </ConfirmationDialog>,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.getByTestId('mediacion-dialog-panel')).toBeTruthy();
    });
  });

  describe('web accessibility — hidden state', () => {
    it('hides all controls and the dialog panel from the tree when visible is false', async () => {
      await render(
        <ConfirmationDialog {...baseProps} visible={false}>
          Body
        </ConfirmationDialog>,
      );
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryByTestId('mediacion-dialog-panel')).toBeNull();
    });
  });

  describe('web accessibility — loading / disabled invariants', () => {
    it('preserves disabled semantics on confirm while loading', async () => {
      await render(
        <ConfirmationDialog {...baseProps} loading>
          Body
        </ConfirmationDialog>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[0].props.accessibilityState.busy).toBe(true);
    });

    it('preserves disabled semantics on confirm when explicitly disabled', async () => {
      await render(
        <ConfirmationDialog {...baseProps} disabled>
          Body
        </ConfirmationDialog>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons[0].props.accessibilityState.disabled).toBe(true);
    });
  });
});
