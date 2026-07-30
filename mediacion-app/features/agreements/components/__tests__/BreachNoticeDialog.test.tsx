import { render, screen } from '@testing-library/react-native';

import { BreachNoticeDialog } from '../BreachNoticeDialog';

describe('BreachNoticeDialog', () => {
  const baseProps = {
    visible: true,
    status: 'idle' as const,
    title: 'Register this notice?',
    body: 'The agreement will be marked "Under notice" and this note stays visible to both parties and, if applicable, the mediator. This does not represent a legal determination.',
    confirmLabel: 'Register notice',
    cancelLabel: 'Cancel',
    errorTitle: "We couldn't register the notice",
    retryLabel: 'Retry',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('idle', () => {
    it('renders the title, body, and confirm/cancel actions', async () => {
      await render(<BreachNoticeDialog {...baseProps} />);
      expect(screen.getByRole('header').props.children).toBe('Register this notice?');
      expect(screen.getByText(baseProps.body)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Register notice' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('renders nothing when not visible', async () => {
      await render(<BreachNoticeDialog {...baseProps} visible={false} />);
      expect(screen.queryByText('Register this notice?')).toBeNull();
    });
  });

  describe('confirm', () => {
    it('calls onConfirm when the confirm action is pressed', async () => {
      const onConfirm = jest.fn();
      await render(<BreachNoticeDialog {...baseProps} onConfirm={onConfirm} />);
      screen.getByRole('button', { name: 'Register notice' }).props.onClick?.({} as never);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the cancel action is pressed', async () => {
      const onCancel = jest.fn();
      await render(<BreachNoticeDialog {...baseProps} onCancel={onCancel} />);
      screen.getByRole('button', { name: 'Cancel' }).props.onClick?.({} as never);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitting', () => {
    it('marks the confirm action busy and disables cancel', async () => {
      await render(<BreachNoticeDialog {...baseProps} status="submitting" />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[0].props.accessibilityState.busy).toBe(true);
      expect(buttons[1].props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('error and retry', () => {
    it('shows the error title instead of the actions row when status is error', async () => {
      await render(<BreachNoticeDialog {...baseProps} status="error" />);
      expect(screen.getByText("We couldn't register the notice")).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Register notice' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('retrying calls onConfirm again', async () => {
      const onConfirm = jest.fn();
      await render(<BreachNoticeDialog {...baseProps} status="error" onConfirm={onConfirm} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('renders no error content when status is idle', async () => {
      await render(<BreachNoticeDialog {...baseProps} />);
      expect(screen.queryByText("We couldn't register the notice")).toBeNull();
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('exposes the title with header semantics', async () => {
      await render(<BreachNoticeDialog {...baseProps} />);
      expect(screen.getByRole('header')).toBeTruthy();
    });

    it('keeps confirm and cancel independently queryable controls', async () => {
      await render(<BreachNoticeDialog {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Register notice' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('copy guard', () => {
    it('never renders accusatory, fault, evidence, or legal-enforcement wording in any state', async () => {
      const statuses = ['idle', 'submitting', 'error'] as const;
      for (const status of statuses) {
        const { unmount } = await render(<BreachNoticeDialog {...baseProps} status={status} />);
        expect(screen.queryByText(/denuncia/i)).toBeNull();
        expect(screen.queryByText(/culpable/i)).toBeNull();
        expect(screen.queryByText(/incumplidor/i)).toBeNull();
        expect(screen.queryByText(/evidencia/i)).toBeNull();
        expect(screen.queryByText(/evidence/i)).toBeNull();
        expect(screen.queryByText(/guilty/i)).toBeNull();
        await unmount();
      }
    });

    it('the confirmation body explicitly disclaims a legal determination', async () => {
      await render(<BreachNoticeDialog {...baseProps} />);
      expect(screen.getByText(/does not represent a legal determination/i)).toBeTruthy();
    });
  });
});
