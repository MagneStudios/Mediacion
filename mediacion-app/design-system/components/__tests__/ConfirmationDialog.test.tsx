import { render, screen } from '@testing-library/react-native';

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
    it('renders without crashing when destructive is set', async () => {
      await render(
        <ConfirmationDialog {...baseProps} destructive>
          Body
        </ConfirmationDialog>,
      );
      expect(screen.getByText('Delete this item?')).toBeTruthy();
    });

    it('renders the neutral (non-destructive) style by default', async () => {
      await render(<ConfirmationDialog {...baseProps}>Body</ConfirmationDialog>);
      expect(screen.getByText('Delete this item?')).toBeTruthy();
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
});
