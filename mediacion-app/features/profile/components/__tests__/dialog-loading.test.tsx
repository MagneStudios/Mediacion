import { render, screen } from '@testing-library/react-native';

import { SignOutDialog } from '../SignOutDialog';
import { DeactivationDialog } from '../DeactivationDialog';

describe('SignOutDialog — loading state', () => {
  const props = { visible: true, title: 'Sign out', body: 'Are you sure?', confirmLabel: 'Sign out', cancelLabel: 'Cancel', errorTitle: 'Error', retryLabel: 'Retry', onConfirm: jest.fn(), onCancel: jest.fn() };

  it('idle: confirm button is not busy', async () => {
    await render(<SignOutDialog {...props} status="idle" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].props.accessibilityState?.busy).toBeFalsy();
    expect(buttons[0].props.accessibilityState?.disabled).toBeFalsy();
  });

  it('pending: confirm button is busy', async () => {
    await render(<SignOutDialog {...props} status="pending" />);
    expect(screen.getByRole('button', { busy: true })).toBeTruthy();
  });

  it('pending: confirm button is disabled', async () => {
    await render(<SignOutDialog {...props} status="pending" />);
    const buttons = screen.getAllByRole('button', { disabled: true });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('dialog stays rendered during pending', async () => {
    await render(<SignOutDialog {...props} status="pending" />);
    expect(screen.getAllByText('Sign out').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Are you sure?').length).toBeGreaterThanOrEqual(1);
  });
});

describe('DeactivationDialog — loading state', () => {
  const props = { visible: true, alreadyRequested: false, title: 'Deactivate', body: 'Confirm deactivation?', alreadyRequestedTitle: 'Already requested', alreadyRequestedBody: 'You have already requested.', confirmLabel: 'Deactivate', cancelLabel: 'Cancel', closeLabel: 'Close', errorTitle: 'Error', retryLabel: 'Retry', onConfirm: jest.fn(), onCancel: jest.fn(), onClose: jest.fn() };

  it('idle: confirm button is not busy', async () => {
    await render(<DeactivationDialog {...props} status="idle" />);
    expect(screen.getAllByRole('button')[0].props.accessibilityState?.busy).toBeFalsy();
  });

  it('pending: confirm button is busy', async () => {
    await render(<DeactivationDialog {...props} status="pending" />);
    expect(screen.getByRole('button', { busy: true })).toBeTruthy();
  });

  it('pending: confirm button is disabled', async () => {
    await render(<DeactivationDialog {...props} status="pending" />);
    const buttons = screen.getAllByRole('button', { disabled: true });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('alreadyRequested: close button does not show spinner', async () => {
    await render(<DeactivationDialog {...props} alreadyRequested status="idle" />);
    expect(screen.getAllByRole('button').length).toBe(1);
    expect(screen.getAllByRole('button')[0].props.accessibilityState?.busy).toBeFalsy();
  });

  it('dialog stays rendered during pending', async () => {
    await render(<DeactivationDialog {...props} status="pending" />);
    expect(screen.getAllByText('Deactivate').length).toBeGreaterThanOrEqual(1);
  });
});
