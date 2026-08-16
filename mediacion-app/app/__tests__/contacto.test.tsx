import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockRequestContact = jest.fn();
const mockGetCompanyInfo = jest.fn();
jest.mock('@/services/legal.service', () => ({
  legalService: {
    requestContact: (...args: unknown[]) => mockRequestContact(...args),
    getCompanyInfo: (...args: unknown[]) => mockGetCompanyInfo(...args),
  },
}));

// eslint-disable-next-line import/first
import ContactoScreen from '../contacto';

const companyInfo = {
  razonSocial: null,
  cuit: null,
  domicilio: null,
  emailContacto: null,
  plazoRespuestaDias: 7,
};

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <ContactoScreen />
    </I18nextProvider>,
  );
}

describe('ContactoScreen — canal de contacto (instructivo §5, punto #23)', () => {
  beforeEach(() => {
    mockRequestContact.mockReset();
    mockGetCompanyInfo.mockReset();
    mockGetCompanyInfo.mockResolvedValue(companyInfo);
  });

  it('declares the response deadline from the company data, before the form', async () => {
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByText(i18n.t('legal.contact.plazo', { dias: 7 }))).toBeTruthy(),
    );
  });

  it('still renders a deadline when the company info cannot be read — the promise is never blank', async () => {
    mockGetCompanyInfo.mockRejectedValue(new Error('down'));
    await renderScreen();
    // Falls back rather than showing an empty or NaN commitment.
    await waitFor(() =>
      expect(screen.getByText(i18n.t('legal.contact.plazo', { dias: 5 }))).toBeTruthy(),
    );
    expect(screen.getByText(i18n.t('legal.contact.submitAction'))).toBeTruthy();
  });

  it('sends the message and shows the CON tracking code', async () => {
    mockRequestContact.mockResolvedValue({ id: 'CON-0001', receivedAt: '2026-08-16T15:02:00.000Z' });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('legal.contact.submitAction'))).toBeTruthy());

    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('legal.contact.nombrePlaceholder')),
      'Ana Pérez',
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('auth.emailPlaceholder')),
      'ana@example.com',
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('legal.contact.mensajePlaceholder')),
      'Quiero consultar por mi plan',
    );
    await waitFor(() => expect(screen.getByDisplayValue('Quiero consultar por mi plan')).toBeTruthy());
    await fireEvent.press(screen.getByText(i18n.t('legal.contact.submitAction')));

    await waitFor(() =>
      expect(mockRequestContact).toHaveBeenCalledWith({
        nombre: 'Ana Pérez',
        email: 'ana@example.com',
        mensaje: 'Quiero consultar por mi plan',
      }),
    );
    await waitFor(() => expect(screen.getByText(i18n.t('legal.contact.success.title'))).toBeTruthy());
    expect(screen.getByText(/CON-0001/)).toBeTruthy();
  });

  it('shows a recoverable error without losing the message', async () => {
    mockRequestContact.mockRejectedValue(new Error('mock_request_contact_failed'));
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('legal.contact.submitAction'))).toBeTruthy());

    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('legal.contact.nombrePlaceholder')),
      'Ana',
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('auth.emailPlaceholder')),
      'ana@example.com',
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('legal.contact.mensajePlaceholder')),
      'Consulta',
    );
    await waitFor(() => expect(screen.getByDisplayValue('Consulta')).toBeTruthy());
    await fireEvent.press(screen.getByText(i18n.t('legal.contact.submitAction')));

    await waitFor(() => expect(screen.getByText(i18n.t('legal.contact.error.title'))).toBeTruthy());
    expect(screen.getByDisplayValue('Consulta')).toBeTruthy();
  });
});
