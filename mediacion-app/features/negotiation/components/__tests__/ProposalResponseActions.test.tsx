import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProposalResponseActions } from '../ProposalResponseActions';

describe('ProposalResponseActions', () => {
  it('renders accept and reject as two independent sibling buttons (never nested)', async () => {
    await render(
      <ProposalResponseActions acceptLabel="Aceptar propuesta" rejectLabel="No aceptar" onAccept={jest.fn()} onReject={jest.fn()} />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('calls onAccept only when accept is pressed', async () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    await render(
      <ProposalResponseActions acceptLabel="Aceptar propuesta" rejectLabel="No aceptar" onAccept={onAccept} onReject={onReject} />,
    );
    await fireEvent.press(screen.getByText('Aceptar propuesta'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();
  });

  it('calls onReject only when reject is pressed', async () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    await render(
      <ProposalResponseActions acceptLabel="Aceptar propuesta" rejectLabel="No aceptar" onAccept={onAccept} onReject={onReject} />,
    );
    await fireEvent.press(screen.getByText('No aceptar'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('disables both actions when disabled is set', async () => {
    await render(
      <ProposalResponseActions acceptLabel="Aceptar propuesta" rejectLabel="No aceptar" onAccept={jest.fn()} onReject={jest.fn()} disabled />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].props.accessibilityState.disabled).toBe(true);
    expect(buttons[1].props.accessibilityState.disabled).toBe(true);
  });
});
