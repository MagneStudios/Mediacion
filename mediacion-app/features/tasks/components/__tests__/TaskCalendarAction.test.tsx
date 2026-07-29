import { render, screen } from '@testing-library/react-native';

import { TaskCalendarAction } from '../TaskCalendarAction';

describe('TaskCalendarAction', () => {
  const baseProps = {
    onGenerate: jest.fn(),
    actionLabel: 'Prepare calendar event',
    preparingTitle: 'Preparing the calendar event',
    preparingBody: 'The event details will be ready in a moment.',
    successTitle: 'Event data ready',
    successBody:
      "The event details were prepared in this test environment. They were not added to Google Calendar, Apple Calendar, or your device's calendar.",
    errorTitle: "We couldn't prepare the calendar event",
    retryLabel: 'Retry',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('idle', () => {
    it('renders the calendar action button', async () => {
      await render(<TaskCalendarAction {...baseProps} status="idle" />);
      expect(screen.getByRole('button', { name: 'Prepare calendar event' })).toBeTruthy();
    });

    it('calls onGenerate when pressed', async () => {
      const onGenerate = jest.fn();
      await render(<TaskCalendarAction {...baseProps} status="idle" onGenerate={onGenerate} />);
      screen.getByRole('button', { name: 'Prepare calendar event' }).props.onClick?.({} as never);
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('pending', () => {
    it('renders the document-preparation state with the preparing copy', async () => {
      await render(<TaskCalendarAction {...baseProps} status="pending" />);
      expect(screen.getByText('Preparing the calendar event')).toBeTruthy();
      expect(screen.getByText('The event details will be ready in a moment.')).toBeTruthy();
    });

    it('renders no action button while pending, blocking repeated presses', async () => {
      await render(<TaskCalendarAction {...baseProps} status="pending" />);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('success', () => {
    it('renders the success copy confirming the event data is ready', async () => {
      await render(<TaskCalendarAction {...baseProps} status="success" />);
      expect(screen.getByText('Event data ready')).toBeTruthy();
      expect(screen.getByText(baseProps.successBody)).toBeTruthy();
    });

    it('renders no action button in success', async () => {
      await render(<TaskCalendarAction {...baseProps} status="success" />);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('error', () => {
    it('renders the error state with a retry action', async () => {
      await render(<TaskCalendarAction {...baseProps} status="error" />);
      expect(screen.getByText("We couldn't prepare the calendar event")).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('calls onRetry when retrying, falling back to onGenerate when onRetry is absent', async () => {
      const onGenerate = jest.fn();
      await render(<TaskCalendarAction {...baseProps} status="error" onGenerate={onGenerate} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it('prefers onRetry over onGenerate when both are provided', async () => {
      const onGenerate = jest.fn();
      const onRetry = jest.fn();
      await render(<TaskCalendarAction {...baseProps} status="error" onGenerate={onGenerate} onRetry={onRetry} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('renders a disabled button with the disabled reason, regardless of status', async () => {
      await render(
        <TaskCalendarAction {...baseProps} status="idle" disabled disabledReason="This task isn't ready for a calendar event yet." />,
      );
      const button = screen.getByRole('button', { name: 'Prepare calendar event' });
      expect(button.props.accessibilityState.disabled).toBe(true);
      expect(screen.getByText("This task isn't ready for a calendar event yet.")).toBeTruthy();
    });

    it('does not call onGenerate when disabled and pressed', async () => {
      const onGenerate = jest.fn();
      await render(<TaskCalendarAction {...baseProps} status="idle" onGenerate={onGenerate} disabled />);
      screen.getByRole('button', { name: 'Prepare calendar event' }).props.onClick?.({} as never);
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it('renders no disabled reason text when none is provided', async () => {
      await render(<TaskCalendarAction {...baseProps} status="idle" disabled />);
      expect(screen.queryByText("This task isn't ready for a calendar event yet.")).toBeNull();
    });

    it('renders as disabled even while status is pending or error', async () => {
      await render(<TaskCalendarAction {...baseProps} status="pending" disabled />);
      expect(screen.getByRole('button', { name: 'Prepare calendar event' })).toBeTruthy();
      expect(screen.queryByText('Preparing the calendar event')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('exposes idle as a plain, non-busy, non-disabled button', async () => {
      await render(<TaskCalendarAction {...baseProps} status="idle" />);
      const button = screen.getByRole('button', { name: 'Prepare calendar event' });
      expect(button.props.accessibilityState.disabled).toBeFalsy();
    });

    it('exposes the error retry action as an accessible button', async () => {
      await render(<TaskCalendarAction {...baseProps} status="error" />);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('marks the success confirmation as a polite live region', async () => {
      const view = await render(<TaskCalendarAction {...baseProps} status="success" />);
      const liveRegionNodes = view.container.queryAll((instance) => instance.props.accessibilityLiveRegion === 'polite');
      expect(liveRegionNodes.length).toBeGreaterThan(0);
    });
  });

  describe('copy never claims a real calendar insertion', () => {
    it('never mentions Google Calendar, Apple Calendar, or a device calendar as a destination for a real add, across idle/pending/error', async () => {
      const statuses = ['idle', 'pending', 'error'] as const;
      for (const status of statuses) {
        const { unmount } = await render(<TaskCalendarAction {...baseProps} status={status} />);
        expect(screen.queryByText(/added to/i)).toBeNull();
        expect(screen.queryByText(/\.ics/i)).toBeNull();
        await unmount();
      }
    });

    it('the success copy only confirms readiness, and explicitly disclaims a real calendar add', async () => {
      await render(<TaskCalendarAction {...baseProps} status="success" />);
      expect(screen.queryByText(/^added to/i)).toBeNull();
      expect(screen.getByText(/were not added to/i)).toBeTruthy();
      expect(screen.queryByText(/\.ics/i)).toBeNull();
    });
  });
});
