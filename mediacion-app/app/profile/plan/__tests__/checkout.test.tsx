import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { Plan } from '@/types/plan';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ planId: 'plan-estudio' }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockGetPlan = jest.fn();
jest.mock('@/services/plans.service', () => ({
  plansService: { getPlan: (...args: unknown[]) => mockGetPlan(...args) },
}));

const mockSubscribeToPlan = jest.fn();
jest.mock('@/services/billing.service', () => ({
  billingService: { subscribeToPlan: (...args: unknown[]) => mockSubscribeToPlan(...args) },
}));

// eslint-disable-next-line import/first
import PlanCheckoutScreen from '../checkout';

const estudioPlan: Plan = { id: 'plan-estudio', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25 };

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <PlanCheckoutScreen />
    </I18nextProvider>,
  );
}

describe('PlanCheckoutScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockBack.mockReset();
    mockGetPlan.mockReset();
    mockSubscribeToPlan.mockReset();
  });

  it('shows the not-found error when the plan does not exist', async () => {
    mockGetPlan.mockResolvedValue(undefined);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.checkout.notFound.title'))).toBeTruthy());
  });

  it('shows the discriminated tax breakdown for the plan (R-09)', async () => {
    mockGetPlan.mockResolvedValue(estudioPlan);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.checkout.breakdown.total'))).toBeTruthy());
    // 25 net, 21% IVA → 5.25 IVA, 30.25 total (see utils/compute-tax-breakdown.test.ts).
    expect(screen.getByText('$25.00')).toBeTruthy();
    expect(screen.getByText('$5.25')).toBeTruthy();
    expect(screen.getByText('$30.25')).toBeTruthy();
  });

  it('shows the sandbox notice — never implies a real charge', async () => {
    mockGetPlan.mockResolvedValue(estudioPlan);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.checkout.sandboxNotice'))).toBeTruthy());
  });

  it('pays, then replaces the route with the receipt screen for the new subscription', async () => {
    mockGetPlan.mockResolvedValue(estudioPlan);
    mockSubscribeToPlan.mockResolvedValue({
      subscription: { id: 'sub-1', planId: 'plan-estudio', estado: 'activa', fechaInicio: '2026-08-10', fechaFin: null },
      invoice: { id: 'inv-1' },
    });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.checkout.payAction'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('billing.checkout.payAction')));

    await waitFor(() => expect(mockSubscribeToPlan).toHaveBeenCalledWith('plan-estudio'));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/profile/plan/receipt', params: { subscriptionId: 'sub-1' } }),
    );
  });

  it('shows a recoverable error when the payment fails, without navigating', async () => {
    mockGetPlan.mockResolvedValue(estudioPlan);
    mockSubscribeToPlan.mockRejectedValue(new Error('mock_subscribe_failed'));
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.checkout.payAction'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('billing.checkout.payAction')));

    await waitFor(() => expect(screen.getByText(i18n.t('billing.checkout.error.title'))).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
