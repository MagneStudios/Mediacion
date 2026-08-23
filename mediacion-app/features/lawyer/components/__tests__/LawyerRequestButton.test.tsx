import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { EstadoSuscripcion } from '@/types/billing';
import type { LawyerServiceOffer } from '@/types/lawyer';

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

let mockSubscriptionResult: unknown;
jest.mock('@/features/billing/hooks/useCurrentSubscription', () => ({
  useCurrentSubscription: () => mockSubscriptionResult,
}));

const mockGetOffer = jest.fn();
const mockRequestLawyer = jest.fn();
jest.mock('@/services/lawyer.service', () => ({
  lawyerService: {
    getOffer: () => mockGetOffer(),
    requestLawyer: (...args: unknown[]) => mockRequestLawyer(...args),
  },
}));

// eslint-disable-next-line import/first
import { LawyerRequestButton } from '../LawyerRequestButton';

const pendingScopeOffer: LawyerServiceOffer = {
  fee: { currency: 'ARS', amountMinor: 4_000_000 },
  scope: null,
  responseHours: null,
};

const publishableOffer: LawyerServiceOffer = {
  fee: { currency: 'ARS', amountMinor: 4_000_000 },
  scope: ['Una consulta de una hora', 'Revisión del expediente'],
  responseHours: 48,
};

function withSubscription(estado: EstadoSuscripcion | null) {
  mockSubscriptionResult = {
    status: 'success',
    subscription: estado
      ? { id: 'sub-1', planId: 'p', estado, fechaInicio: null, fechaFin: null }
      : null,
    reload: jest.fn(),
  };
}

async function renderButton() {
  await render(
    <I18nextProvider i18n={i18n}>
      <LawyerRequestButton casoId="case-1" />
    </I18nextProvider>,
  );
}

describe('LawyerRequestButton', () => {
  beforeEach(() => {
    mockGetOffer.mockReset().mockResolvedValue(pendingScopeOffer);
    mockRequestLawyer.mockReset();
    withSubscription('activa');
  });

  it('draws nothing until the subscription is known', async () => {
    // A button that shows up enabled and switches off half a second later is
    // worse than one that arrives late.
    mockSubscriptionResult = { status: 'loading', subscription: null };
    await renderButton();

    expect(screen.queryByText(i18n.t('lawyer.action'))).toBeNull();
  });

  describe('who can ask', () => {
    it.each<[EstadoSuscripcion]>([['activa'], ['vencida']])(
      'lets a %s subscription open the dialog',
      async (estado) => {
        // `vencida` is the spec's `past_due`: there are 7 days of grace and
        // the charge is being retried, so access is not cut yet.
        withSubscription(estado);
        await renderButton();

        expect(screen.queryByText(i18n.t('lawyer.needsActivePlan'))).toBeNull();
        fireEvent.press(screen.getByText(i18n.t('lawyer.action')));
        expect(await screen.findByText(i18n.t('lawyer.dialog.title'))).toBeTruthy();
      },
    );

    it.each<[EstadoSuscripcion | null]>([['pendiente_pago'], ['pausada'], ['cancelada'], [null]])(
      'blocks %s and says why',
      async (estado) => {
        withSubscription(estado);
        await renderButton();

        expect(screen.getByText(i18n.t('lawyer.needsActivePlan'))).toBeTruthy();
      },
    );
  });

  describe('while the scope is not defined', () => {
    it('says so instead of inventing what the service includes', async () => {
      // Decisión #1 del spec, de Solmi, marcada como bloqueante para publicar:
      // "no se puede cobrar sin decir qué se entrega".
      await renderButton();
      fireEvent.press(screen.getByText(i18n.t('lawyer.action')));

      expect(await screen.findByText(i18n.t('lawyer.dialog.scopePending'))).toBeTruthy();
    });

    it('does not let anyone pay', async () => {
      await renderButton();
      fireEvent.press(screen.getByText(i18n.t('lawyer.action')));
      await screen.findByText(i18n.t('lawyer.dialog.title'));

      fireEvent.press(screen.getByText(i18n.t('lawyer.dialog.confirm')));

      await waitFor(() => expect(mockRequestLawyer).not.toHaveBeenCalled());
    });
  });

  describe('once the scope is published', () => {
    beforeEach(() => {
      mockGetOffer.mockResolvedValue(publishableOffer);
      mockRequestLawyer.mockResolvedValue({
        id: 'lawreq-0001',
        casoId: 'case-1',
        estado: 'pendiente_pago',
        fee: publishableOffer.fee,
        createdAt: '2026-08-23T12:00:00.000Z',
      });
    });

    it('shows the price in the currency the offer carries, not a hardcoded one', async () => {
      // El precio viaja en unidades mínimas: 4.000.000 son ARS 40.000.
      await renderButton();
      fireEvent.press(screen.getByText(i18n.t('lawyer.action')));

      const shown = await screen.findByText(new RegExp('40'));
      expect(shown).toBeTruthy();
      expect(screen.queryByText(i18n.t('lawyer.dialog.scopePending'))).toBeNull();
    });

    it('registers the request for this case', async () => {
      await renderButton();
      fireEvent.press(screen.getByText(i18n.t('lawyer.action')));
      await screen.findByText(i18n.t('lawyer.dialog.title'));

      fireEvent.press(screen.getByText(i18n.t('lawyer.dialog.confirm')));

      await waitFor(() => expect(mockRequestLawyer).toHaveBeenCalledWith('case-1'));
    });

    it('reports a failed request without losing the dialog', async () => {
      mockRequestLawyer.mockRejectedValue(new Error('boom'));
      await renderButton();
      fireEvent.press(screen.getByText(i18n.t('lawyer.action')));
      await screen.findByText(i18n.t('lawyer.dialog.title'));

      fireEvent.press(screen.getByText(i18n.t('lawyer.dialog.confirm')));

      expect(await screen.findByText(i18n.t('lawyer.dialog.error.title'))).toBeTruthy();
    });
  });
});
