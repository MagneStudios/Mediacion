import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockCreatePlan = jest.fn();
jest.mock('@/services/plans.service', () => ({
  plansService: { createPlan: (...args: unknown[]) => mockCreatePlan(...args) },
}));

// eslint-disable-next-line import/first
import CreatePlanScreen from '../create';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <CreatePlanScreen />
    </I18nextProvider>,
  );
}

// changeText's state update doesn't always land before the very next
// synchronous interaction in this test environment (observed empirically on
// this deeply-nested useId()-labelled Input) — waitFor confirms the value
// actually committed before moving on, so submit() always reads live state.
async function fillNombre(value: string) {
  fireEvent.changeText(screen.getByLabelText(i18n.t('admin.planes.form.nombreLabel')), value);
  await waitFor(() => expect(screen.getByLabelText(i18n.t('admin.planes.form.nombreLabel')).props.value).toBe(value));
}

async function fillPrecio(value: string) {
  fireEvent.changeText(screen.getByLabelText(i18n.t('admin.planes.form.precioLabel')), value);
  await waitFor(() => expect(screen.getByLabelText(i18n.t('admin.planes.form.precioLabel')).props.value).toBe(value));
}

function submit() {
  return fireEvent.press(screen.getByText(i18n.t('admin.planes.create.save')));
}

describe('CreatePlanScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCreatePlan.mockReset();
  });

  it('renders the three limit fields, defaulting to "ilimitado"', async () => {
    await renderScreen();
    const unlimitedOptions = screen.getAllByText(i18n.t('admin.planes.form.unlimitedOption.title'));
    expect(unlimitedOptions).toHaveLength(3);
  });

  it('shows a validation error and does not submit when nombre is blank', async () => {
    await renderScreen();
    await fillPrecio('10');
    submit();
    await waitFor(() => expect(screen.getByText(i18n.t('admin.planes.form.nombreError'))).toBeTruthy());
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it('requires a numeric value once a limit field is switched to "con límite"', async () => {
    await renderScreen();
    await fillNombre('premium');
    await fillPrecio('10');
    fireEvent.press(screen.getAllByText(i18n.t('admin.planes.form.limitedOption.title'))[0]);
    // Same settling concern as fillNombre/fillPrecio: the "con límite"
    // selection needs to land before submit() reads state, and its own
    // number input appearing is the observable signal that it has.
    await waitFor(() => expect(screen.getByLabelText(i18n.t('admin.planes.form.limiteCasos.numberLabel'))).toBeTruthy());
    submit();
    await waitFor(() => expect(screen.getByText(i18n.t('admin.planes.form.limitRequiredError'))).toBeTruthy());
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it('creates the plan with null limiteCasos and -1 limiteCarpetas/limiteIteracionesIa when left unlimited, then navigates back', async () => {
    mockCreatePlan.mockResolvedValue({ id: 'new-plan', nombre: 'premium', limiteCasos: null, limiteCarpetas: -1, limiteIteracionesIa: -1, precio: 10 });
    await renderScreen();
    await fillNombre('premium');
    await fillPrecio('10');
    submit();

    await waitFor(() =>
      expect(mockCreatePlan).toHaveBeenCalledWith({
        nombre: 'premium',
        precio: 10,
        limiteCasos: null,
        limiteCarpetas: -1,
        limiteIteracionesIa: -1,
      }),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows a dedicated error when the nombre is already taken', async () => {
    mockCreatePlan.mockRejectedValue(new Error('plan_nombre_taken'));
    await renderScreen();
    await fillNombre('base');
    await fillPrecio('10');
    submit();

    await waitFor(() => expect(screen.getByText(i18n.t('admin.planes.form.nombreTakenError'))).toBeTruthy());
    expect(mockBack).not.toHaveBeenCalled();
  });
});
