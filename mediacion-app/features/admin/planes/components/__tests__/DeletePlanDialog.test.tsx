import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeletePlanDialog } from '../DeletePlanDialog';

// Mirrors design-system/components/__tests__/ConfirmationDialog.test.tsx and
// features/profile/components/__tests__/dialog-loading.test.tsx's approach:
// `visible` is always true here, never toggled via a parent's state — RN's
// own Modal only renders reliably in this test environment when `visible`
// is true from the very first render (see app/admin/planes/__tests__/index.test.tsx
// for why the screen-level delete flow is not asserted through the modal).
describe('DeletePlanDialog', () => {
  const baseProps = {
    visible: true,
    title: 'Delete this plan?',
    body: 'You are about to delete the "base" plan. This action cannot be undone.',
    confirmLabel: 'Delete plan',
    cancelLabel: 'Cancel',
    errorTitle: "We couldn't delete the plan",
    retryLabel: 'Retry',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title and body', async () => {
    await render(<DeletePlanDialog {...baseProps} status="idle" />);
    expect(screen.getByText('Delete this plan?')).toBeTruthy();
    expect(screen.getByText(/base.*plan/)).toBeTruthy();
  });

  it('calls onConfirm when the confirm action is pressed', async () => {
    const onConfirm = jest.fn();
    await render(<DeletePlanDialog {...baseProps} status="idle" onConfirm={onConfirm} />);
    fireEvent.press(screen.getByText('Delete plan'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel action is pressed', async () => {
    const onCancel = jest.fn();
    await render(<DeletePlanDialog {...baseProps} status="idle" onCancel={onCancel} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('marks the confirm action busy while deleting', async () => {
    await render(<DeletePlanDialog {...baseProps} status="deleting" />);
    expect(screen.getByRole('button', { busy: true })).toBeTruthy();
  });

  it('shows the error state with retry instead of the confirm/cancel actions', async () => {
    await render(<DeletePlanDialog {...baseProps} status="error" />);
    expect(screen.getByText("We couldn't delete the plan")).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('retrying from the error state calls onConfirm again', async () => {
    const onConfirm = jest.fn();
    await render(<DeletePlanDialog {...baseProps} status="error" onConfirm={onConfirm} />);
    fireEvent.press(screen.getByText('Retry'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
