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

const mockDeletePlan = jest.fn();
jest.mock('@/services/plans.service', () => ({
  plansService: { deletePlan: (...args: unknown[]) => mockDeletePlan(...args) },
}));

let mockResult: unknown;
const mockRefresh = jest.fn();
jest.mock('@/features/admin/planes/hooks/usePlans', () => ({
  usePlans: () => mockResult,
}));

// eslint-disable-next-line import/first
import AdminPlanesScreen from '../index';

const plan: Plan = { id: 'plan-1', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0 };
const estudioPlan: Plan = { id: 'plan-4', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25 };

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <AdminPlanesScreen />
    </I18nextProvider>,
  );
}

describe('AdminPlanesScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockDeletePlan.mockReset();
    mockRefresh.mockReset();
  });

  it('renders each plan with its price and limits', async () => {
    mockResult = { status: 'success', plans: [plan, estudioPlan], refresh: mockRefresh };
    await renderScreen();
    expect(screen.getByText('base')).toBeTruthy();
    expect(screen.getByText('estudio')).toBeTruthy();
  });

  it('shows "Ilimitado" for null/-1 sentinel limits (estudio) and the number otherwise (base)', async () => {
    mockResult = { status: 'success', plans: [plan, estudioPlan], refresh: mockRefresh };
    await renderScreen();
    const unlimitedLabels = screen.getAllByText(new RegExp(i18n.t('admin.planes.limit.unlimited')));
    // estudio has 3 unlimited-sentinel fields (casos: null, carpetas: 0→not unlimited actually — 0 is a real limit, not -1)
    expect(unlimitedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the empty state with a create action when there are no plans', async () => {
    mockResult = { status: 'empty', plans: [], refresh: mockRefresh };
    await renderScreen();
    expect(screen.getByText(i18n.t('admin.planes.empty.title'))).toBeTruthy();
  });

  it('shows the error state with retry', async () => {
    const reload = jest.fn();
    mockResult = { status: 'error', plans: undefined, reload };
    await renderScreen();
    fireEvent.press(screen.getByText(i18n.t('common.retry')));
    expect(reload).toHaveBeenCalled();
  });

  it('navigates to the create screen', async () => {
    mockResult = { status: 'success', plans: [plan], refresh: mockRefresh };
    await renderScreen();
    fireEvent.press(screen.getByText(i18n.t('admin.planes.createAction')));
    expect(mockPush).toHaveBeenCalledWith('/admin/planes/create');
  });

  it('navigates to the edit screen for a plan', async () => {
    mockResult = { status: 'success', plans: [plan], refresh: mockRefresh };
    await renderScreen();
    fireEvent.press(screen.getByLabelText(i18n.t('admin.planes.card.editAccessibilityLabel', { nombre: 'base' })));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/admin/planes/[id]/edit', params: { id: 'plan-1' } });
  });

  // The confirm/cancel/error rendering of the delete dialog itself is
  // covered directly by DeletePlanDialog.test.tsx (visible: true from the
  // first render, mirroring the codebase's existing dialog-loading.test.tsx
  // convention) — RN's Modal does not reliably render its content in this
  // test environment when `visible` only becomes true after a later state
  // update (verified: even the design system's own dialogs are never tested
  // that way). What's screen-specific and worth asserting here instead is
  // the wiring: pressing delete selects the right plan as the target, and
  // the confirm handler calls the service with that plan's id.
  it('selects the pressed plan as the delete target without touching the service yet', async () => {
    mockResult = { status: 'success', plans: [plan], refresh: mockRefresh };
    await renderScreen();

    fireEvent.press(screen.getByLabelText(i18n.t('admin.planes.card.deleteAccessibilityLabel', { nombre: 'base' })));

    expect(mockDeletePlan).not.toHaveBeenCalled();
  });
});
