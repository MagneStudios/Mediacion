import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { Plan } from '@/types/plan';
import { formatEventDate } from '@/utils/format-legal-date';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

let mockSubscriptionResult: unknown;
jest.mock('@/features/billing/hooks/useCurrentSubscription', () => ({
  useCurrentSubscription: () => mockSubscriptionResult,
}));

let mockPlansResult: unknown;
jest.mock('@/features/plans/hooks/usePlans', () => ({
  usePlans: () => mockPlansResult,
}));

// eslint-disable-next-line import/first
import MyPlanScreen from '../index';

const basePlan: Plan = { id: 'plan-base', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0 };
const estudioPlan: Plan = { id: 'plan-estudio', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25 };

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <MyPlanScreen />
    </I18nextProvider>,
  );
}

describe('MyPlanScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('shows the no-subscription copy and every plan as subscribable when there is no current subscription', async () => {
    mockSubscriptionResult = { status: 'success', subscription: null, reload: jest.fn() };
    mockPlansResult = { status: 'success', plans: [basePlan, estudioPlan], refresh: jest.fn() };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.myPlan.noSubscription'))).toBeTruthy();
    expect(screen.getAllByText(i18n.t('billing.myPlan.subscribeAction'))).toHaveLength(2);
    expect(screen.queryByText(i18n.t('billing.myPlan.currentBadge'))).toBeNull();
  });

  it('marks the subscribed plan as current and hides its subscribe action', async () => {
    mockSubscriptionResult = {
      status: 'success',
      subscription: { id: 'sub-1', planId: 'plan-base', estado: 'activa', fechaInicio: null, fechaFin: null },
      reload: jest.fn(),
    };
    mockPlansResult = { status: 'success', plans: [basePlan, estudioPlan], refresh: jest.fn() };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.myPlan.currentBadge'))).toBeTruthy();
    expect(screen.getAllByText(i18n.t('billing.myPlan.subscribeAction'))).toHaveLength(1);
  });

  it('navigates to checkout with the pressed plan id', async () => {
    mockSubscriptionResult = { status: 'success', subscription: null, reload: jest.fn() };
    mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    await renderScreen();

    fireEvent.press(screen.getByText(i18n.t('billing.myPlan.subscribeAction')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/profile/plan/checkout', params: { planId: 'plan-base' } });
  });

  it('shows loading while either the subscription or the plan list is still loading', async () => {
    mockSubscriptionResult = { status: 'loading', subscription: null };
    mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    await renderScreen();
    expect(screen.getByText(i18n.t('common.loading'))).toBeTruthy();
  });

  it('shows the error state when either fetch fails', async () => {
    mockSubscriptionResult = { status: 'error', subscription: null, reload: jest.fn() };
    mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    await renderScreen();
    expect(screen.getByText(i18n.t('billing.myPlan.error.title'))).toBeTruthy();
  });

  /**
   * `GET /suscripciones/vigente` does not filter by estado — it orders by it —
   * so every value of `estado_suscripcion` reaches this screen. Only `activa`
   * is a current plan; the other three each need their own answer, and none of
   * them may promise service until a date (see `utils/subscription-notice.ts`).
   */
  describe('a subscription that is not activa', () => {
    function renderWithEstado(estado: string, fechaFin: string | null) {
      mockSubscriptionResult = {
        status: 'success',
        subscription: { id: 'sub-1', planId: 'plan-base', estado, fechaInicio: null, fechaFin },
        reload: jest.fn(),
      };
      mockPlansResult = { status: 'success', plans: [basePlan, estudioPlan], refresh: jest.fn() };
      return renderScreen();
    }

    it('is never badged as the current plan and never offers the baja again', async () => {
      await renderWithEstado('cancelada', '2026-08-17T12:00:00.000Z');

      expect(screen.queryByText(i18n.t('billing.myPlan.currentBadge'))).toBeNull();
      expect(screen.queryByText(i18n.t('billing.myPlan.cancel.action'))).toBeNull();
      expect(screen.getByText(i18n.t('billing.myPlan.noSubscription'))).toBeTruthy();
      // Both plans stay subscribable: the user has no plan, so nothing is
      // excluded from the offer.
      expect(screen.getAllByText(i18n.t('billing.myPlan.subscribeAction'))).toHaveLength(2);
    });

    it('acknowledges the baja with the date it was registered', async () => {
      await renderWithEstado('cancelada', '2026-08-17T12:00:00.000Z');

      const date = formatEventDate('2026-08-17T12:00:00.000Z', i18n.language);
      expect(screen.getByText(i18n.t('billing.myPlan.notice.cancelled', { date }))).toBeTruthy();
      // `fechaFin` is when the cancellation was written, not when access ends,
      // so the screen must not read as "you keep the plan until that date".
      expect(screen.queryByText(i18n.t('billing.myPlan.notice.expired', { date }))).toBeNull();
    });

    it('acknowledges a baja that arrived without a date', async () => {
      await renderWithEstado('cancelada', null);
      expect(screen.getByText(i18n.t('billing.myPlan.notice.cancelledUndated'))).toBeTruthy();
    });

    it('tells a vencida apart from a cancelada', async () => {
      await renderWithEstado('vencida', '2026-07-01T12:00:00.000Z');

      const date = formatEventDate('2026-07-01T12:00:00.000Z', i18n.language);
      expect(screen.getByText(i18n.t('billing.myPlan.notice.expired', { date }))).toBeTruthy();
      expect(screen.queryByText(i18n.t('billing.myPlan.notice.cancelled', { date }))).toBeNull();
    });

    it('reports pendiente_pago instead of inviting the user to contract twice', async () => {
      // The column default of `POST /suscripciones`, so this is what a real
      // checkout leaves behind before the payment is confirmed.
      await renderWithEstado('pendiente_pago', null);
      expect(screen.getByText(i18n.t('billing.myPlan.notice.pendingPayment'))).toBeTruthy();
    });
  });

  it('says nothing extra about an active subscription, and offers the baja', async () => {
    mockSubscriptionResult = {
      status: 'success',
      subscription: { id: 'sub-1', planId: 'plan-base', estado: 'activa', fechaInicio: null, fechaFin: null },
      reload: jest.fn(),
    };
    mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    await renderScreen();

    expect(screen.getByText(i18n.t('billing.myPlan.cancel.action'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('billing.myPlan.notice.cancelledUndated'))).toBeNull();
    expect(screen.queryByText(i18n.t('billing.myPlan.notice.pendingPayment'))).toBeNull();
  });
});
