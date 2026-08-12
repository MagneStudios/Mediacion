import { fireEvent, render, screen } from '@testing-library/react-native';

import { JoinCaseForm } from '../JoinCaseForm';

describe('JoinCaseForm', () => {
  const baseProps = {
    value: '',
    onChangeText: jest.fn(),
    status: 'idle' as const,
    onSubmit: jest.fn(),
    title: 'Join a case',
    description: 'Enter the invitation link or code you received to join a case.',
    inputLabel: 'Invitation link or code',
    inputPlaceholder: 'Paste or type it here',
    submitLabel: 'Join case',
    submittingLabel: 'Loading…',
    errorTitle: "We couldn't complete this action right now",
    errorDescription: 'Check the link or code and try again.',
    retryLabel: 'Retry',
    expiredTitle: 'This invitation expired',
    expiredDescription: 'Ask the other party to send you a new invitation.',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('idle', () => {
    it('renders the title, input, and submit action', async () => {
      await render(<JoinCaseForm {...baseProps} />);
      expect(screen.getByRole('header')).toBeTruthy();
      expect(screen.getByText('Invitation link or code')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Join case' })).toBeTruthy();
    });

    it('renders the description when provided', async () => {
      await render(<JoinCaseForm {...baseProps} />);
      expect(screen.getByText('Enter the invitation link or code you received to join a case.')).toBeTruthy();
    });
  });

  describe('input change', () => {
    it('calls onChangeText as the user types', async () => {
      const onChangeText = jest.fn();
      await render(<JoinCaseForm {...baseProps} onChangeText={onChangeText} />);
      fireEvent.changeText(screen.getByPlaceholderText('Paste or type it here'), 'ABC-123');
      expect(onChangeText).toHaveBeenCalledWith('ABC-123');
    });
  });

  describe('disabled when blank', () => {
    it('disables submit when value is empty', async () => {
      await render(<JoinCaseForm {...baseProps} value="" />);
      const button = screen.getByRole('button', { name: 'Join case' });
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('disables submit when value is only whitespace', async () => {
      await render(<JoinCaseForm {...baseProps} value="   " />);
      const button = screen.getByRole('button', { name: 'Join case' });
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('enables submit once a non-blank value is entered', async () => {
      await render(<JoinCaseForm {...baseProps} value="ABC-123" />);
      const button = screen.getByRole('button', { name: 'Join case' });
      expect(button.props.accessibilityState.disabled).toBe(false);
    });
  });

  describe('submitting', () => {
    it('marks the submit action busy and shows the submitting label', async () => {
      await render(<JoinCaseForm {...baseProps} value="ABC-123" status="submitting" />);
      const button = screen.getByRole('button', { name: 'Loading…' });
      expect(button.props.accessibilityState.busy).toBe(true);
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('makes the input non-editable while submitting', async () => {
      await render(<JoinCaseForm {...baseProps} value="ABC-123" status="submitting" />);
      expect(screen.getByPlaceholderText('Paste or type it here').props.editable).toBe(false);
    });
  });

  describe('error', () => {
    it('renders the error state instead of the submit button', async () => {
      await render(<JoinCaseForm {...baseProps} value="ABC-123" status="error" />);
      expect(screen.getByText("We couldn't complete this action right now")).toBeTruthy();
      expect(screen.getByText('Check the link or code and try again.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Join case' })).toBeNull();
    });

    it('retries via onSubmit when the retry action is pressed', async () => {
      const onSubmit = jest.fn();
      await render(<JoinCaseForm {...baseProps} value="ABC-123" status="error" onSubmit={onSubmit} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('expired', () => {
    it('renders the expired state instead of the submit button, with no retry action', async () => {
      await render(<JoinCaseForm {...baseProps} value="ABC-123" status="expired" />);
      expect(screen.getByText('This invitation expired')).toBeTruthy();
      expect(screen.getByText('Ask the other party to send you a new invitation.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Join case' })).toBeNull();
    });
  });

  describe('submit callback', () => {
    it('calls onSubmit when the submit action is pressed with a non-blank value', async () => {
      const onSubmit = jest.fn();
      await render(<JoinCaseForm {...baseProps} value="ABC-123" onSubmit={onSubmit} />);
      screen.getByRole('button', { name: 'Join case' }).props.onClick?.({} as never);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('does not call onSubmit when pressed while blank', async () => {
      const onSubmit = jest.fn();
      await render(<JoinCaseForm {...baseProps} value="" onSubmit={onSubmit} />);
      screen.getByRole('button', { name: 'Join case' }).props.onClick?.({} as never);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
