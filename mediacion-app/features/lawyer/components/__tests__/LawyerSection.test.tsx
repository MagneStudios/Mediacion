import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { LawyerRequest } from '@/types/lawyer';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/config/env-source', () => ({
  expoPublicEnv: { EXPO_PUBLIC_ESTUDIO_WHATSAPP: undefined },
}));

// La sección no mira la suscripción; el botón que envuelve sí. Se le da una
// activa para que se dibuje y la sección quede observable.
jest.mock('@/features/billing/hooks/useCurrentSubscription', () => ({
  useCurrentSubscription: () => ({
    status: 'success',
    subscription: {
      id: 'sub-1',
      planId: 'p',
      estado: 'activa',
      fechaInicio: null,
      fechaFin: null,
    },
    reload: jest.fn(),
  }),
}));

const mockGetRequest = jest.fn();
const mockGetOffer = jest.fn();
const mockSimulatePaymentConfirmation = jest.fn();
jest.mock('@/services/lawyer.service', () => ({
  lawyerService: {
    getRequest: (...args: unknown[]) => mockGetRequest(...args),
    getOffer: () => mockGetOffer(),
    requestLawyer: jest.fn(),
    simulatePaymentConfirmation: (...args: unknown[]) => mockSimulatePaymentConfirmation(...args),
  },
}));

// eslint-disable-next-line import/first
import { LawyerSection } from '../LawyerSection';

function request(estado: LawyerRequest['estado']): LawyerRequest {
  return {
    id: 'lawreq-0007',
    casoId: 'case-1',
    estado,
    fee: { currency: 'ARS', amountMinor: 5_000_000 },
    createdAt: '2026-09-03T12:00:00.000Z',
    handoff: estado === 'pagada' ? { estudioWhatsapp: null, codigo: 'lawreq-0007' } : null,
  };
}

async function renderSection() {
  await render(
    <I18nextProvider i18n={i18n}>
      <LawyerSection casoId="case-1" />
    </I18nextProvider>,
  );
}

describe('LawyerSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOffer.mockResolvedValue({
      fee: { currency: 'ARS', amountMinor: 5_000_000 },
      scope: null,
      responseHours: null,
    });
  });

  it('ofrece contratar cuando el caso nunca pidió abogado', async () => {
    mockGetRequest.mockResolvedValue(null);
    await renderSection();

    expect(await screen.findByText(i18n.t('lawyer.action'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('lawyer.handoff.title'))).toBeNull();
  });

  it('con el pago confirmado deja de ofrecer contratar y pasa al handoff', async () => {
    mockGetRequest.mockResolvedValue(request('pagada'));
    await renderSection();

    expect(await screen.findByText(i18n.t('lawyer.handoff.title'))).toBeTruthy();
    // Volver a ofrecer "necesito un abogado" sobre un caso ya pagado es el
    // camino al doble cobro que el spec §7.6 pide evitar.
    expect(screen.queryByText(i18n.t('lawyer.action'))).toBeNull();
  });

  it('el atajo de demo lleva de pendiente_pago al handoff', async () => {
    mockGetRequest.mockResolvedValue(request('pendiente_pago'));
    mockSimulatePaymentConfirmation.mockResolvedValue(request('pagada'));
    await renderSection();

    fireEvent.press(await screen.findByText(i18n.t('lawyer.simulatePayment.action')));

    expect(await screen.findByText(i18n.t('lawyer.handoff.title'))).toBeTruthy();
    expect(mockSimulatePaymentConfirmation).toHaveBeenCalledWith('case-1');
  });

  it('no ofrece el atajo de demo sin una solicitud pendiente', async () => {
    mockGetRequest.mockResolvedValue(null);
    await renderSection();

    await screen.findByText(i18n.t('lawyer.action'));
    expect(screen.queryByText(i18n.t('lawyer.simulatePayment.action'))).toBeNull();
  });

  it('avisa si la simulación falla, en vez de quedarse muda', async () => {
    mockGetRequest.mockResolvedValue(request('pendiente_pago'));
    mockSimulatePaymentConfirmation.mockRejectedValue(new Error('boom'));
    await renderSection();

    fireEvent.press(await screen.findByText(i18n.t('lawyer.simulatePayment.action')));

    expect(await screen.findByText(i18n.t('lawyer.simulatePayment.error'))).toBeTruthy();
  });

  it('no dibuja nada mientras la solicitud no está resuelta', async () => {
    // Una tarjeta que aparece y se reemplaza sola es peor que una que llega
    // tarde: el mismo criterio que usa el botón con la suscripción.
    mockGetRequest.mockReturnValue(new Promise(() => {}));
    await renderSection();

    await waitFor(() => expect(mockGetRequest).toHaveBeenCalled());
    expect(screen.queryByText(i18n.t('lawyer.action'))).toBeNull();
    expect(screen.queryByText(i18n.t('lawyer.handoff.title'))).toBeNull();
  });
});
