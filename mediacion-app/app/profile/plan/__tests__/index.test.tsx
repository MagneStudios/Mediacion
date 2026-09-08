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

let mockUsageResult: unknown;
jest.mock('@/features/billing/hooks/useSubscriptionUsage', () => ({
  useSubscriptionUsage: () => mockUsageResult,
}));

let mockPlansResult: unknown;
jest.mock('@/features/plans/hooks/usePlans', () => ({
  usePlans: () => mockPlansResult,
}));

// eslint-disable-next-line import/first
import MyPlanScreen from '../index';

const basePlan: Plan = { id: 'plan-base', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null };
const estudioPlan: Plan = { id: 'plan-estudio', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25, moneda: 'ARS', maxNegotiationsPerPeriod: 3, maxClientsPerPeriod: 20 };
const simplePlan: Plan = { id: 'plan-simple', nombre: 'simple', limiteCarpetas: 5, limiteCasos: 3, limiteIteracionesIa: 10, precio: 9.99, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null };

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <MyPlanScreen />
    </I18nextProvider>,
  );
}

const usageReload = jest.fn();

describe('MyPlanScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    usageReload.mockReset();
    // The common case for a persona with no plan, and the default every test
    // that is not about usage inherits.
    mockUsageResult = { status: 'success', usage: null, reload: usageReload };
  });

  describe('el bloque de consumo', () => {
    const withPlan = () => {
      mockSubscriptionResult = { status: 'success', subscription: null, reload: jest.fn() };
      mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    };

    it('renders the counters when there is usage to report', async () => {
      withPlan();
      mockUsageResult = {
        status: 'success',
        usage: {
          periodStart: '2026-08-17T12:00:00.000Z',
          periodEnd: '2026-09-16T12:00:00.000Z',
          negotiations: { used: 2, limit: 3 },
          clients: null,
        },
        reload: usageReload,
      };

      await renderScreen();

      expect(screen.getByText(i18n.t('billing.usage.count', { used: 2, limit: 3 }))).toBeTruthy();
    });

    it('says nothing when there is no plan to measure against', async () => {
      // `usage: null` in `success` means "no plan", which the copy above the
      // plan list already says. An empty card would say it twice.
      withPlan();

      await renderScreen();

      expect(screen.queryByText(i18n.t('billing.usage.title'))).toBeNull();
    });

    it('reports its own failure in place, with its own retry, instead of taking the screen down', async () => {
      // Usage is supplementary — the person came to see their plan. A failing
      // `/uso` must not replace the whole screen with an error state.
      withPlan();
      mockUsageResult = { status: 'error', usage: null, reload: usageReload };

      await renderScreen();

      expect(screen.getByText(i18n.t('billing.myPlan.noSubscription'))).toBeTruthy();
      expect(screen.getByText(i18n.t('billing.usage.error'))).toBeTruthy();

      fireEvent.press(screen.getByText(i18n.t('common.retry')));
      expect(usageReload).toHaveBeenCalled();
    });

    it('does not hold the screen in loading while usage is still in flight', async () => {
      withPlan();
      mockUsageResult = { status: 'loading', usage: null, reload: usageReload };

      await renderScreen();

      expect(screen.getByText(i18n.t('billing.myPlan.noSubscription'))).toBeTruthy();
    });
  });

  it('shows a period quota only on a plan that declares one', async () => {
    // `null` does mean unlimited here — `consume_quota` says so — but announcing
    // "negociaciones por período: ilimitado" on `base`, which is capped at two
    // simultaneous cases, sells a freedom the stock limit beside it takes away.
    // The limit that actually binds `base` is already on its card.
    mockSubscriptionResult = { status: 'success', subscription: null, reload: jest.fn() };
    mockPlansResult = { status: 'success', plans: [basePlan, estudioPlan], refresh: jest.fn() };

    await renderScreen();

    expect(
      screen.getByText(`${i18n.t('billing.myPlan.negotiationsPerPeriodLabel')}: 3`),
    ).toBeTruthy();
    expect(screen.getByText(`${i18n.t('billing.myPlan.clientsPerPeriodLabel')}: 20`)).toBeTruthy();
    // One pill, not two: only `estudioPlan` carries the quota.
    expect(
      screen.queryAllByText(
        new RegExp(`^${i18n.t('billing.myPlan.negotiationsPerPeriodLabel')}:`),
      ),
    ).toHaveLength(1);
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

  /**
   * The heart of punto #24 in the UI: the price the catalog card leads with
   * is the FINAL one. 9.99 net + AR IVA 21% (2.10) → 12.09 total; the jest
   * runtime language is 'en', so Intl renders en-US + ARS as "ARS<nbsp>…"
   * (same empirically verified format as checkout.test.tsx).
   */
  it('the catalog card shows the final price with taxes included, the legend, and the net as secondary data', async () => {
    mockSubscriptionResult = { status: 'success', subscription: null, reload: jest.fn() };
    mockPlansResult = { status: 'success', plans: [simplePlan], refresh: jest.fn() };
    await renderScreen();

    expect(screen.getByText('ARS 12.09')).toBeTruthy();
    expect(screen.getByText(i18n.t('billing.myPlan.taxesIncluded'))).toBeTruthy();
    expect(
      screen.getByText(`${i18n.t('billing.checkout.breakdown.neto')}: ARS 9.99`),
    ).toBeTruthy();
  });

  it('a free plan shows only the formatted zero — no taxes legend and no duplicated net', async () => {
    mockSubscriptionResult = { status: 'success', subscription: null, reload: jest.fn() };
    mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    await renderScreen();

    expect(screen.getByText('ARS 0.00')).toBeTruthy();
    expect(screen.queryByText(i18n.t('billing.myPlan.taxesIncluded'))).toBeNull();
    expect(
      screen.queryByText(`${i18n.t('billing.checkout.breakdown.neto')}: ARS 0.00`),
    ).toBeNull();
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

  /**
   * BE decided (18/08) that `fecha_fin` is the instant of the baja — there is
   * no data backing any "until the end of the paid period" promise, so the
   * dialog must not make one. Aligned with `billing.myPlan.notice.cancelled`.
   */
  it('opens the baja dialog with copy that promises no further charge and no remaining validity', async () => {
    mockSubscriptionResult = {
      status: 'success',
      subscription: { id: 'sub-1', planId: 'plan-base', estado: 'activa', fechaInicio: null, fechaFin: null },
      reload: jest.fn(),
    };
    mockPlansResult = { status: 'success', plans: [basePlan], refresh: jest.fn() };
    await renderScreen();

    fireEvent.press(screen.getByText(i18n.t('billing.myPlan.cancel.action')));

    expect(await screen.findByText(i18n.t('billing.myPlan.cancel.dialogBody'))).toBeTruthy();
    const esBody = i18n.t('billing.myPlan.cancel.dialogBody', { lng: 'es-AR' });
    const enBody = i18n.t('billing.myPlan.cancel.dialogBody', { lng: 'en' });
    expect(esBody).toContain('No se vuelve a cobrar');
    expect(esBody).not.toMatch(/hasta el final del per/i);
    expect(enBody).not.toMatch(/until the end of the period/i);
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
