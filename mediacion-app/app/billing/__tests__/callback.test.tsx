import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

let mockConfirmation: unknown;
jest.mock('@/features/billing/hooks/usePaymentConfirmation', () => ({
  usePaymentConfirmation: () => mockConfirmation,
}));

// eslint-disable-next-line import/first
import BillingCallbackScreen from '../callback';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <BillingCallbackScreen />
    </I18nextProvider>,
  );
}

describe('BillingCallbackScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockParams = {};
  });

  it('waits visibly instead of claiming anything about the payment', async () => {
    mockConfirmation = { status: 'confirming', subscription: null };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.callback.confirming.title'))).toBeTruthy();
    // No verdict of any kind while it waits — neither success nor failure.
    expect(screen.queryByText(i18n.t('billing.callback.confirmed.title'))).toBeNull();
    expect(screen.queryByText(i18n.t('billing.callback.stillPending.title'))).toBeNull();
  });

  it('does not believe the status MercadoPago put in the URL', async () => {
    // The return URL is attacker-controlled: anyone can open the callback with
    // `?status=approved`. The activation lives in the webhook (spec §6.3.5),
    // so the only thing this screen trusts is our own API — which here still
    // says it is waiting.
    mockParams = { status: 'approved', collection_status: 'approved', preapproval_id: 'x' };
    mockConfirmation = { status: 'confirming', subscription: null };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.callback.confirming.title'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('billing.callback.confirmed.title'))).toBeNull();
  });

  it('confirms only when the subscription really came back active', async () => {
    mockConfirmation = {
      status: 'confirmed',
      subscription: { id: 'sub-1', planId: 'p', estado: 'activa', fechaInicio: null, fechaFin: null },
    };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.callback.confirmed.title'))).toBeTruthy();

    fireEvent.press(screen.getByText(i18n.t('billing.callback.goHomeAction')));
    // Home rather than Mi plan: navigating from here to `/profile/plan`
    // renders `/profile/edit` (see the screen's own note). `replace`, so going
    // back does not return to a wait for a payment that already resolved.
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('offers the contact channel when the wait ran out, and calls it a delay', async () => {
    mockConfirmation = {
      status: 'stillPending',
      subscription: { id: 'sub-1', planId: 'p', estado: 'pendiente_pago', fechaInicio: null, fechaFin: null },
    };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.callback.stillPending.title'))).toBeTruthy();

    fireEvent.press(screen.getByText(i18n.t('billing.callback.contactAction')));
    expect(mockPush).toHaveBeenCalledWith('/contacto');
    // The way out is still offered, so nobody is stranded on the wait.
    expect(screen.getByText(i18n.t('billing.callback.goHomeAction'))).toBeTruthy();
  });

  it('shows the subscription reference once there is a row to name', async () => {
    // What the user quotes if they do end up writing to us.
    mockConfirmation = {
      status: 'stillPending',
      subscription: { id: 'sub-42', planId: 'p', estado: 'pendiente_pago', fechaInicio: null, fechaFin: null },
    };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.callback.reference', { id: 'sub-42' }))).toBeTruthy();
  });
});
