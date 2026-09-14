import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { Plan } from '@/types/plan';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams: { joinToken?: string } = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

let mockPlansResult: unknown;
jest.mock('@/features/plans/hooks/usePlans', () => ({
  usePlans: () => mockPlansResult,
}));

const mockStartCheckout = jest.fn();
jest.mock('@/services/billing.service', () => ({
  billingService: { startCheckout: (...args: unknown[]) => mockStartCheckout(...args) },
}));

// eslint-disable-next-line import/first
import SignupPlanScreen from '../plan';

const basePlan: Plan = { id: 'plan-base', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null };
const corporativoPlan: Plan = { id: 'plan-corporativo', nombre: 'corporativo', limiteCarpetas: -1, limiteCasos: null, limiteIteracionesIa: -1, precio: 0, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null };
const estudioPlan: Plan = { id: 'plan-estudio', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25, moneda: 'ARS', maxNegotiationsPerPeriod: 3, maxClientsPerPeriod: 20 };

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <SignupPlanScreen />
    </I18nextProvider>,
  );
}

describe('SignupPlanScreen (punto #2)', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockStartCheckout.mockReset();
    mockSearchParams = {};
  });

  it('shows the loading state while the catalog loads', async () => {
    mockPlansResult = { status: 'loading', plans: undefined };
    await renderScreen();
    expect(screen.getByText(i18n.t('auth.signUp.plan.loading'))).toBeTruthy();
  });

  it('shows a retry-able error if the catalog fails to load', async () => {
    const reload = jest.fn();
    mockPlansResult = { status: 'error', plans: undefined, reload };
    await renderScreen();
    expect(screen.getByText(i18n.t('auth.signUp.plan.error.title'))).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t('auth.signUp.plan.error.retry')));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lists every plan in the catalog', async () => {
    mockPlansResult = { status: 'success', plans: [basePlan, estudioPlan], refresh: jest.fn() };
    await renderScreen();
    expect(screen.getByText('base')).toBeTruthy();
    expect(screen.getByText('estudio')).toBeTruthy();
  });

  describe('el plan base (gratis, self-serve)', () => {
    // `startCheckout`, no `subscribeToPlan`: contra backend real,
    // `subscribeToPlan` es mock-only para siempre (no hay endpoint de
    // factura) — `startCheckout` es lo que BE activa de verdad sin pasar
    // por Mercado Pago para un plan de precio 0 (fix(pagos) 10/09).
    it('activa el plan via startCheckout (kind: activated) y termina el alta en el dashboard', async () => {
      mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
      mockStartCheckout.mockResolvedValue({ kind: 'activated', subscriptionId: 'sub-1' });
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledWith('plan-base'));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('también funciona contra el mock (kind: simulated)', async () => {
      mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
      mockStartCheckout.mockResolvedValue({
        kind: 'simulated',
        subscription: { id: 'sub-1' },
        invoice: { id: 'inv-1' },
      });
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    });

    it('si viene con un joinToken pendiente, termina en /case/join con el código precargado en vez del dashboard', async () => {
      mockSearchParams = { joinToken: 'mediacionapp://invitacion/mock-abc123' };
      mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
      mockStartCheckout.mockResolvedValue({ kind: 'activated', subscriptionId: 'sub-1' });
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/case/join',
          params: { token: 'mediacionapp://invitacion/mock-abc123' },
        }),
      );
    });

    it('defensivo: si el servidor devuelve un checkout real (kind: redirect) para "base", cae al checkout real en vez de manejarlo acá', async () => {
      mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
      mockStartCheckout.mockResolvedValue({ kind: 'redirect', subscriptionId: 'sub-1', checkoutUrl: 'https://mp/x' });
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith({ pathname: '/profile/plan/checkout', params: { planId: 'plan-base' } }),
      );
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('shows a recoverable error and does not navigate when starting checkout fails', async () => {
      mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
      mockStartCheckout.mockRejectedValue(new Error('mock_subscribe_failed'));
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      await waitFor(() => expect(screen.getByText(i18n.t('auth.signUp.plan.subscribeError.title'))).toBeTruthy());
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('un plan pago', () => {
    it('navega al checkout existente en vez de suscribir inline', async () => {
      mockPlansResult = { status: 'success', plans: [estudioPlan], refresh: jest.fn() };
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      expect(mockPush).toHaveBeenCalledWith({ pathname: '/profile/plan/checkout', params: { planId: 'plan-estudio' } });
      expect(mockStartCheckout).not.toHaveBeenCalled();
    });
  });

  describe('plan-corporativo: precio 0 pero NO es el plan gratis self-serve', () => {
    // mocks/plans.ts documenta esto explícitamente: corporativo comparte
    // precio 0 con base, pero significa "a consultar", no "gratis". Si el
    // wizard gatillara por precio en vez de por el plan, un usuario nuevo
    // terminaría "suscripto" gratis a un plan pensado para venta negociada.
    it('también va a checkout, no se suscribe inline pese a precio 0', async () => {
      mockPlansResult = { status: 'success', plans: [corporativoPlan], refresh: jest.fn() };
      await renderScreen();

      await fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));

      expect(mockPush).toHaveBeenCalledWith({ pathname: '/profile/plan/checkout', params: { planId: 'plan-corporativo' } });
      expect(mockStartCheckout).not.toHaveBeenCalled();
    });
  });
});
