import { render, screen } from '@testing-library/react-native';

import { TaskCard } from '../TaskCard';

describe('TaskCard', () => {
  const baseProps = {
    description: 'Deliver the agreed documents',
    status: 'pendiente' as const,
    statusLabel: 'Pending',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('statuses', () => {
    it('renders the description and status label for pendiente', async () => {
      await render(<TaskCard {...baseProps} status="pendiente" statusLabel="Pending" />);
      expect(screen.getByText('Deliver the agreed documents')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
    });

    it('renders the status label for en_progreso', async () => {
      await render(<TaskCard {...baseProps} status="en_progreso" statusLabel="In progress" />);
      expect(screen.getByText('In progress')).toBeTruthy();
    });

    it('renders the status label for completada', async () => {
      await render(<TaskCard {...baseProps} status="completada" statusLabel="Completed" />);
      expect(screen.getByText('Completed')).toBeTruthy();
    });
  });

  describe('description as header', () => {
    it('exposes the description with header semantics', async () => {
      await render(<TaskCard {...baseProps} />);
      const header = screen.getByRole('header');
      expect(header.props.children).toBe('Deliver the agreed documents');
    });
  });

  describe('event date', () => {
    it('renders the event date label when provided', async () => {
      await render(<TaskCard {...baseProps} eventDateLabel="15 Aug 2026, 10:00" />);
      expect(screen.getByText('15 Aug 2026, 10:00')).toBeTruthy();
    });

    it('renders no date text when eventDateLabel is absent', async () => {
      await render(<TaskCard {...baseProps} />);
      expect(screen.queryByText(/2026/)).toBeNull();
    });
  });

  describe('primary action', () => {
    it('renders no action when actionLabel/onAction are absent', async () => {
      await render(<TaskCard {...baseProps} />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('renders no action when only actionLabel is provided', async () => {
      await render(<TaskCard {...baseProps} actionLabel="Mark complete" />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('renders the action when both actionLabel and onAction are provided', async () => {
      await render(<TaskCard {...baseProps} actionLabel="Mark complete" onAction={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Mark complete' })).toBeTruthy();
    });

    it('calls onAction when the action is pressed', async () => {
      const onAction = jest.fn();
      await render(<TaskCard {...baseProps} actionLabel="Mark complete" onAction={onAction} />);
      screen.getByRole('button', { name: 'Mark complete' }).props.onClick?.({} as never);
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading', () => {
    it('marks the action busy and shows the loading label while actionLoading is true', async () => {
      await render(
        <TaskCard
          {...baseProps}
          actionLabel="Mark complete"
          onAction={jest.fn()}
          actionLoading
          actionLoadingLabel="Saving…"
        />,
      );
      const button = screen.getByRole('button', { name: 'Saving…' });
      expect(button.props.accessibilityState.busy).toBe(true);
    });

    it('does not call onAction while loading', async () => {
      const onAction = jest.fn();
      await render(
        <TaskCard {...baseProps} actionLabel="Mark complete" onAction={onAction} actionLoading actionLoadingLabel="Saving…" />,
      );
      screen.getByRole('button', { name: 'Saving…' }).props.onClick?.({} as never);
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('renders the action disabled when actionDisabled is set', async () => {
      await render(<TaskCard {...baseProps} actionLabel="Mark complete" onAction={jest.fn()} actionDisabled />);
      const button = screen.getByRole('button', { name: 'Mark complete' });
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('does not call onAction when disabled', async () => {
      const onAction = jest.fn();
      await render(<TaskCard {...baseProps} actionLabel="Mark complete" onAction={onAction} actionDisabled />);
      screen.getByRole('button', { name: 'Mark complete' }).props.onClick?.({} as never);
      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('accessibility labels', () => {
    it('exposes eventDateLabel as an accessibility label on the date text', async () => {
      await render(<TaskCard {...baseProps} eventDateLabel="15 Aug 2026, 10:00" />);
      expect(screen.getByLabelText('15 Aug 2026, 10:00')).toBeTruthy();
    });

    it('applies a disambiguating accessibilityLabel to the action when provided', async () => {
      await render(
        <TaskCard
          {...baseProps}
          actionLabel="Mark complete"
          onAction={jest.fn()}
          actionAccessibilityLabel="Mark complete: Deliver the agreed documents"
        />,
      );
      expect(screen.getByLabelText('Mark complete: Deliver the agreed documents')).toBeTruthy();
    });

    it('falls back to the visible action label when actionAccessibilityLabel is omitted', async () => {
      await render(<TaskCard {...baseProps} actionLabel="Mark complete" onAction={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Mark complete' })).toBeTruthy();
    });
  });
});
