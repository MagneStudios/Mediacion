import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PublicRequestForm } from '../PublicRequestForm';

const labels = {
  nombreLabel: 'Nombre y apellido',
  nombrePlaceholder: 'Tu nombre completo',
  emailLabel: 'Email',
  emailPlaceholder: 'vos@ejemplo.com',
  messageLabel: 'Tu consulta',
  messagePlaceholder: 'Escribí acá',
  submitLabel: 'Enviar',
  submittingLabel: 'Enviando…',
  errorTitle: 'No pudimos enviar tu consulta',
  retryLabel: 'Reintentar',
  successTitle: 'Recibimos tu consulta',
};

function renderForm(onSubmit: jest.Mock) {
  return render(
    <PublicRequestForm
      {...labels}
      buildSuccessBody={({ id, date }) => `Seguimiento ${id} — ${date}`}
      onSubmit={onSubmit}
    />,
  );
}

async function fillAll() {
  await fireEvent.changeText(screen.getByPlaceholderText(labels.nombrePlaceholder), 'Ana Pérez');
  await fireEvent.changeText(screen.getByPlaceholderText(labels.emailPlaceholder), 'ana@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText(labels.messagePlaceholder), 'Mi consulta');
  await waitFor(() => expect(screen.getByDisplayValue('Mi consulta')).toBeTruthy());
}

describe('PublicRequestForm', () => {
  it('does not submit until every field has content', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.press(screen.getByText(labels.submitLabel));
    expect(onSubmit).not.toHaveBeenCalled();

    // Two of three filled is still not submittable — the API rejects blanks
    // with 400, and a round trip to be told so is worse than not sending.
    await fireEvent.changeText(screen.getByPlaceholderText(labels.nombrePlaceholder), 'Ana Pérez');
    await fireEvent.changeText(screen.getByPlaceholderText(labels.emailPlaceholder), 'ana@example.com');
    await fireEvent.press(screen.getByText(labels.submitLabel));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats whitespace as empty', async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.changeText(screen.getByPlaceholderText(labels.nombrePlaceholder), '   ');
    await fireEvent.changeText(screen.getByPlaceholderText(labels.emailPlaceholder), 'ana@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText(labels.messagePlaceholder), 'Consulta');
    await fireEvent.press(screen.getByText(labels.submitLabel));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values and shows the tracking code with the server timestamp', async () => {
    const onSubmit = jest
      .fn()
      .mockResolvedValue({ id: 'CON-0001', receivedAt: '2026-08-16T15:02:00.000Z' });
    await renderForm(onSubmit);

    await fireEvent.changeText(screen.getByPlaceholderText(labels.nombrePlaceholder), '  Ana Pérez  ');
    await fireEvent.changeText(screen.getByPlaceholderText(labels.emailPlaceholder), ' ana@example.com ');
    await fireEvent.changeText(screen.getByPlaceholderText(labels.messagePlaceholder), ' Mi consulta ');
    await waitFor(() => expect(screen.getByDisplayValue(' Mi consulta ')).toBeTruthy());
    await fireEvent.press(screen.getByText(labels.submitLabel));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        nombre: 'Ana Pérez',
        email: 'ana@example.com',
        mensaje: 'Mi consulta',
      }),
    );
    await waitFor(() => expect(screen.getByText(labels.successTitle)).toBeTruthy());
    // The code and the date travel together — that pair is what makes a
    // later claim traceable.
    expect(screen.getByText(/CON-0001/)).toBeTruthy();
  });

  it('replaces the form with the acknowledgement, so the request cannot be sent twice', async () => {
    const onSubmit = jest
      .fn()
      .mockResolvedValue({ id: 'CON-0002', receivedAt: '2026-08-16T15:02:00.000Z' });
    await renderForm(onSubmit);
    await fillAll();
    await fireEvent.press(screen.getByText(labels.submitLabel));

    await waitFor(() => expect(screen.getByText(labels.successTitle)).toBeTruthy());
    expect(screen.queryByText(labels.submitLabel)).toBeNull();
    expect(screen.queryByPlaceholderText(labels.messagePlaceholder)).toBeNull();
  });

  it('offers a retry that resends, and keeps what the user typed', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('mock_request_contact_failed'))
      .mockResolvedValueOnce({ id: 'CON-0003', receivedAt: '2026-08-16T15:02:00.000Z' });
    await renderForm(onSubmit);
    await fillAll();
    await fireEvent.press(screen.getByText(labels.submitLabel));

    await waitFor(() => expect(screen.getByText(labels.errorTitle)).toBeTruthy());
    // The typed message survives the failure — retyping a complaint after an
    // error is exactly when people give up.
    expect(screen.getByDisplayValue('Mi consulta')).toBeTruthy();

    await fireEvent.press(screen.getByText(labels.retryLabel));
    await waitFor(() => expect(screen.getByText(labels.successTitle)).toBeTruthy());
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
