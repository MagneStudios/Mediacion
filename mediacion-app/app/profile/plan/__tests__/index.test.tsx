import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { Plan } from '@/types/plan';

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
});
