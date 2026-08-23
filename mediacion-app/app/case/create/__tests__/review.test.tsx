import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import { ApiError } from '@/services/api/api-error';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockSetCreatedCase = jest.fn();
jest.mock('@/features/cases/hooks/useCaseCreationFlow', () => ({
  useCaseCreationFlow: () => ({
    draft: { nombre: 'Reparto de bienes', descripcion: '', metodo: 'negociacion' },
    setCreatedCase: mockSetCreatedCase,
  }),
}));

const mockCreateCase = jest.fn();
jest.mock('@/services/cases.service', () => ({
  casesService: { createCase: (...args: unknown[]) => mockCreateCase(...args) },
}));

// eslint-disable-next-line import/first
import CaseCreateReviewScreen from '../review';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <CaseCreateReviewScreen />
    </I18nextProvider>,
  );
}

function create() {
  return fireEvent.press(screen.getByText(i18n.t('caseCreation.review.create')));
}

describe('CaseCreateReviewScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockCreateCase.mockReset();
    mockSetCreatedCase.mockReset();
  });

  it('advances to the invitation step when the case is created', async () => {
    mockCreateCase.mockResolvedValue({ id: 'caso-1' });
    await renderScreen();

    // Sin `waitFor`: `fireEvent` corre dentro de `act`, así que al await le
    // toca vaciar la microtask del `createCase` resuelto y el efecto que le
    // sigue. Un `waitFor` acá no espera nada real — lo único que agrega es un
    // presupuesto de un segundo de reloj, y con la caché de jest fría este
    // archivo tardó 5,5 s en arrancar y lo agotó. La prueba no cambia; deja
    // de poder fallar por lo lento que esté la máquina.
    await create();

    expect(mockSetCreatedCase).toHaveBeenCalledWith('caso-1');
    expect(mockPush).toHaveBeenCalledWith('/case/create/invite');
  });

  it('still offers a retry for a failure that retrying could fix', async () => {
    mockCreateCase.mockRejectedValue(new ApiError('internal_error', 'boom', 500));
    await renderScreen();

    await create();

    expect(await screen.findByText(i18n.t('caseCreation.review.error.title'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('billing.quotaLimit.upgradeAction'))).toBeNull();
  });

  describe('when the plan says no', () => {
    it('shows the limit dialog instead of a retry the plan cannot satisfy', async () => {
      // The live error today: `PlanLimitService` answers 403 with no numbers.
      // Before this, it fell into the generic error state with a retry button
      // that could only fail again for as long as the plan was full.
      mockCreateCase.mockRejectedValue(
        new ApiError('plan_limit_exceeded', 'Plan case limit reached', 403),
      );
      await renderScreen();

      await create();

      expect(await screen.findByText(i18n.t('billing.quotaLimit.title.casos'))).toBeTruthy();
      expect(screen.getByText(i18n.t('billing.quotaLimit.bodyUnknown'))).toBeTruthy();
      expect(screen.queryByText(i18n.t('caseCreation.review.error.title'))).toBeNull();
      expect(screen.queryByText(i18n.t('caseCreation.review.error.retry'))).toBeNull();
    });

    it('leaves the create action usable once the dialog is closed, not stuck in a spinner', async () => {
      // The draft is intact and the user can still go back and edit it, so the
      // screen must return to idle rather than stay in `submitting`.
      //
      // Asserted *after* dismissing on purpose: while the dialog is open the
      // whole screen behind it is inert for accessibility, so the button is in
      // the tree but not queryable — which is exactly what a modal should do.
      mockCreateCase.mockRejectedValue(new ApiError('plan_limit_exceeded', 'x', 403));
      await renderScreen();

      await create();
      await fireEvent.press(await screen.findByText(i18n.t('billing.quotaLimit.dismissAction')));

      await waitFor(() =>
        expect(screen.getByText(i18n.t('caseCreation.review.create'))).toBeTruthy(),
      );
      expect(screen.queryByText(i18n.t('caseCreation.review.creating'))).toBeNull();
    });

    it('spells out the numbers when the server sends them', async () => {
      // The 402 of the spec, which the API does not send yet. Same dialog, no
      // change here the day it starts arriving.
      mockCreateCase.mockRejectedValue(
        new ApiError('quota_exceeded', 'x', 402, {
          recurso: 'negociaciones',
          usado: 3,
          limite: 3,
          period_end: '2026-09-14T12:00:00.000Z',
        }),
      );
      await renderScreen();

      await create();

      expect(
        await screen.findByText(i18n.t('billing.quotaLimit.title.negociaciones')),
      ).toBeTruthy();
      expect(
        screen.getByText(
          new RegExp(i18n.t('billing.quotaLimit.body.negociaciones', { used: 3, limit: 3 })),
        ),
      ).toBeTruthy();
    });

    it('sends the user to the plans screen from the dialog', async () => {
      mockCreateCase.mockRejectedValue(new ApiError('plan_limit_exceeded', 'x', 403));
      await renderScreen();

      await create();
      await fireEvent.press(await screen.findByText(i18n.t('billing.quotaLimit.upgradeAction')));

      expect(mockPush).toHaveBeenCalledWith('/profile/plan');
      // And the dialog closes on the way out, so coming back does not land on
      // a modal about a limit the user may have just resolved.
      await waitFor(() =>
        expect(screen.queryByText(i18n.t('billing.quotaLimit.title.casos'))).toBeNull(),
      );
    });

    it('can be dismissed without navigating anywhere', async () => {
      mockCreateCase.mockRejectedValue(new ApiError('plan_limit_exceeded', 'x', 403));
      await renderScreen();

      await create();
      await fireEvent.press(await screen.findByText(i18n.t('billing.quotaLimit.dismissAction')));

      await waitFor(() =>
        expect(screen.queryByText(i18n.t('billing.quotaLimit.title.casos'))).toBeNull(),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
