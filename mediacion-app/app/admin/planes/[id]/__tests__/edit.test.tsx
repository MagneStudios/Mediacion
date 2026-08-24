import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { Plan } from '@/types/plan';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: 'plan-1' }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockGetPlan = jest.fn();
const mockUpdatePlan = jest.fn();
jest.mock('@/services/plans.service', () => ({
  plansService: {
    getPlan: (...args: unknown[]) => mockGetPlan(...args),
    updatePlan: (...args: unknown[]) => mockUpdatePlan(...args),
  },
}));

// eslint-disable-next-line import/first
import EditPlanScreen from '../edit';

const basePlan: Plan = { id: 'plan-1', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0, moneda: 'ARS' };
const estudioPlan: Plan = { id: 'plan-1', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25, moneda: 'ARS' };
const plusPlan: Plan = { id: 'plan-1', nombre: 'plus', limiteCarpetas: -1, limiteCasos: -1, limiteIteracionesIa: -1, precio: 19.99, moneda: 'ARS' };

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <EditPlanScreen />
    </I18nextProvider>,
  );
}

// See create.test.tsx's fillNombre/fillPrecio comment: changeText's state
// update needs a waitFor to be observed as committed before the next
// synchronous interaction in this test environment.
async function changeAndConfirm(label: string, value: string) {
  fireEvent.changeText(screen.getByLabelText(label), value);
  await waitFor(() => expect(screen.getByLabelText(label).props.value).toBe(value));
}

describe('EditPlanScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockGetPlan.mockReset();
    mockUpdatePlan.mockReset();
  });

  it('shows the not-found error when the plan does not exist', async () => {
    mockGetPlan.mockResolvedValue(undefined);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('admin.planes.edit.notFound.title'))).toBeTruthy());
  });

  it('prefills the form with the fetched plan, keeping a concrete limit as "con límite"', async () => {
    mockGetPlan.mockResolvedValue(basePlan);
    await renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('base')).toBeTruthy());
    expect(screen.getByDisplayValue('0')).toBeTruthy(); // precio
    // limiteCasos = 2 is a concrete limit → the "con límite" branch renders its number input.
    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  // Every limit field always renders both the "Unlimited" and "With a limit"
  // radio cards, whichever is selected — so counting `getAllByText` matches
  // of the label only ever finds 3 (one per field), selected or not. The
  // selection itself lives in `accessibilityState.selected`.
  function countSelectedUnlimitedCards(): number {
    return screen
      .getAllByLabelText(i18n.t('admin.planes.form.unlimitedOption.title'))
      .filter((card) => card.props.accessibilityState?.selected === true).length;
  }

  it('treats limiteCasos: null (estudio, R-10) as "ilimitado", leaving the concrete carpetas/iteraciones fields (0) as "con límite"', async () => {
    mockGetPlan.mockResolvedValue(estudioPlan);
    await renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('estudio')).toBeTruthy());
    // Only limiteCasos is null here — limiteCarpetas/limiteIteracionesIa are
    // 0, a concrete value, not the -1 sentinel, so they stay "con límite".
    expect(countSelectedUnlimitedCards()).toBe(1);
  });

  it('treats the -1 sentinel (plus plan, pre-R-10 rows) as "ilimitado" for all three fields', async () => {
    mockGetPlan.mockResolvedValue(plusPlan);
    await renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('plus')).toBeTruthy());
    expect(countSelectedUnlimitedCards()).toBe(3);
  });

  it('saves the edited plan and navigates back', async () => {
    mockGetPlan.mockResolvedValue(basePlan);
    mockUpdatePlan.mockResolvedValue({ ...basePlan, precio: 5 });
    await renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('base')).toBeTruthy());

    await changeAndConfirm(i18n.t('admin.planes.form.precioLabel'), '5');
    fireEvent.press(screen.getByText(i18n.t('admin.planes.edit.save')));

    await waitFor(() =>
      expect(mockUpdatePlan).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({ nombre: 'base', precio: 5, limiteCasos: 2 }),
      ),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows a dedicated error when saving to an already-used nombre', async () => {
    mockGetPlan.mockResolvedValue(basePlan);
    mockUpdatePlan.mockRejectedValue(new Error('plan_nombre_taken'));
    await renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('base')).toBeTruthy());

    await changeAndConfirm(i18n.t('admin.planes.form.nombreLabel'), 'simple');
    fireEvent.press(screen.getByText(i18n.t('admin.planes.edit.save')));

    await waitFor(() => expect(screen.getByText(i18n.t('admin.planes.form.nombreTakenError'))).toBeTruthy());
    expect(mockBack).not.toHaveBeenCalled();
  });
});
