import { fireEvent, render, screen } from '@testing-library/react-native';

import { BreachNoticeForm } from '../BreachNoticeForm';

describe('BreachNoticeForm', () => {
  const baseProps = {
    description: '',
    onChangeDescription: jest.fn(),
    status: 'idle' as const,
    onSubmit: jest.fn(),
    title: 'Register a breach notice',
    descriptionLabel: 'What happened',
    descriptionHint: 'Describe what happened in your own words.',
    descriptionPlaceholder: 'Describe what happened',
    submitLabel: 'Register notice',
    submittingLabel: 'Registering…',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the title, description input, and submit action', async () => {
      await render(<BreachNoticeForm {...baseProps} />);
      expect(screen.getByRole('header')).toBeTruthy();
      expect(screen.getByText('What happened')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Register notice' })).toBeTruthy();
    });

    it('renders the description hint when there is no validation error', async () => {
      await render(<BreachNoticeForm {...baseProps} />);
      expect(screen.getByText('Describe what happened in your own words.')).toBeTruthy();
    });

    it('calls onChangeDescription as the user types', async () => {
      const onChangeDescription = jest.fn();
      await render(<BreachNoticeForm {...baseProps} onChangeDescription={onChangeDescription} />);
      fireEvent.changeText(screen.getByPlaceholderText('Describe what happened'), 'They missed the handover.');
      expect(onChangeDescription).toHaveBeenCalledWith('They missed the handover.');
    });
  });

  describe('blank and whitespace validation', () => {
    it('disables submit when the description is empty', async () => {
      await render(<BreachNoticeForm {...baseProps} description="" />);
      const button = screen.getByRole('button', { name: 'Register notice' });
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('disables submit when the description is only whitespace', async () => {
      await render(<BreachNoticeForm {...baseProps} description="   " />);
      const button = screen.getByRole('button', { name: 'Register notice' });
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('enables submit once a non-blank description is entered', async () => {
      await render(<BreachNoticeForm {...baseProps} description="They missed the handover." />);
      const button = screen.getByRole('button', { name: 'Register notice' });
      expect(button.props.accessibilityState.disabled).toBe(false);
    });

    it('does not call onSubmit when pressed while blank', async () => {
      const onSubmit = jest.fn();
      await render(<BreachNoticeForm {...baseProps} description="" onSubmit={onSubmit} />);
      screen.getByRole('button', { name: 'Register notice' }).props.onClick?.({} as never);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('validation error', () => {
    it('renders the caller-supplied validation error instead of the hint', async () => {
      await render(<BreachNoticeForm {...baseProps} description="" descriptionError="Enter a description before continuing." />);
      expect(screen.getByText('Enter a description before continuing.')).toBeTruthy();
      expect(screen.queryByText('Describe what happened in your own words.')).toBeNull();
    });

    it('renders no error text when descriptionError is absent', async () => {
      await render(<BreachNoticeForm {...baseProps} />);
      expect(screen.queryByText('Enter a description before continuing.')).toBeNull();
    });
  });

  describe('submit callback', () => {
    it('calls onSubmit when pressed with a non-blank description', async () => {
      const onSubmit = jest.fn();
      await render(<BreachNoticeForm {...baseProps} description="They missed the handover." onSubmit={onSubmit} />);
      screen.getByRole('button', { name: 'Register notice' }).props.onClick?.({} as never);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitting/disabled behavior', () => {
    it('marks the submit action busy and shows the submitting label while submitting', async () => {
      await render(<BreachNoticeForm {...baseProps} description="They missed the handover." status="submitting" />);
      const button = screen.getByRole('button', { name: 'Registering…' });
      expect(button.props.accessibilityState.busy).toBe(true);
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('makes the input non-editable while submitting', async () => {
      await render(<BreachNoticeForm {...baseProps} description="They missed the handover." status="submitting" />);
      expect(screen.getByPlaceholderText('Describe what happened').props.editable).toBe(false);
    });

    it('does not call onSubmit while submitting', async () => {
      const onSubmit = jest.fn();
      await render(<BreachNoticeForm {...baseProps} description="They missed the handover." status="submitting" onSubmit={onSubmit} />);
      screen.getByRole('button', { name: 'Registering…' }).props.onClick?.({} as never);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('associates the description label with the input', async () => {
      await render(<BreachNoticeForm {...baseProps} />);
      const input = screen.getByPlaceholderText('Describe what happened');
      expect(input.props.accessibilityLabelledBy).toBeTruthy();
    });

    it('exposes the validation error as an accessibility hint on the input', async () => {
      await render(<BreachNoticeForm {...baseProps} description="" descriptionError="Enter a description before continuing." />);
      const input = screen.getByPlaceholderText('Describe what happened');
      expect(input.props.accessibilityHint).toBe('Enter a description before continuing.');
    });
  });

  describe('copy guard', () => {
    it('never renders accusatory or legal-enforcement wording', async () => {
      await render(
        <BreachNoticeForm
          {...baseProps}
          description=""
          descriptionError="Enter a description before continuing."
          status="submitting"
        />,
      );
      expect(screen.queryByText(/denuncia/i)).toBeNull();
      expect(screen.queryByText(/culpable/i)).toBeNull();
      expect(screen.queryByText(/incumplidor/i)).toBeNull();
      expect(screen.queryByText(/evidencia/i)).toBeNull();
      expect(screen.queryByText(/evidence/i)).toBeNull();
      expect(screen.queryByText(/guilty/i)).toBeNull();
      expect(screen.queryByText(/legal determination/i)).toBeNull();
    });
  });
});
