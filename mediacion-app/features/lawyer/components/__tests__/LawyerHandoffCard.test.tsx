import { I18nextProvider } from 'react-i18next';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { LawyerRequest } from '@/types/lawyer';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

let mockEnvNumber: string | undefined;
jest.mock('@/config/env-source', () => ({
  get expoPublicEnv() {
    return { EXPO_PUBLIC_ESTUDIO_WHATSAPP: mockEnvNumber };
  },
}));

// eslint-disable-next-line import/first
import { LawyerHandoffCard } from '../LawyerHandoffCard';

function paidRequest(estudioWhatsapp: string | null): LawyerRequest {
  return {
    id: 'lawreq-0007',
    casoId: 'case-1',
    estado: 'pagada',
    fee: { currency: 'ARS', amountMinor: 5_000_000 },
    createdAt: '2026-09-03T12:00:00.000Z',
    handoff: { estudioWhatsapp, codigo: 'lawreq-0007' },
  };
}

async function renderCard(request: LawyerRequest) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LawyerHandoffCard request={request} />
    </I18nextProvider>,
  );
}

/**
 * El spy sobre `Linking.openURL` se crea una sola vez y se resetea por test.
 * `jest.restoreAllMocks()` no lo suelta —bajo jest-expo el módulo se vuelve a
 * envolver en vez de restaurarse— y un spy compartido que acumula llamadas
 * hace que un test lea la URL del anterior.
 */
let openURL: jest.SpyInstance;

describe('LawyerHandoffCard', () => {
  beforeEach(() => {
    mockEnvNumber = undefined;
    openURL = jest.spyOn(Linking, 'openURL');
    openURL.mockReset();
    openURL.mockResolvedValue(undefined as never);
  });

  describe('con el número del estudio', () => {
    it('abre wa.me con el mensaje precargado', async () => {
      await renderCard(paidRequest('+54 9 11 5555-4444'));

      fireEvent.press(screen.getByText(i18n.t('lawyer.handoff.action')));

      await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1));
      const url = openURL.mock.calls[0][0];
      expect(url).toContain('https://wa.me/5491155554444?text=');
      expect(decodeURIComponent(url)).toContain('lawreq-0007');
    });

    it('no manda nada del caso en la URL más que el código (spec §7.5)', async () => {
      await renderCard(paidRequest('+5491155554444'));

      fireEvent.press(screen.getByText(i18n.t('lawyer.handoff.action')));

      await waitFor(() => expect(openURL).toHaveBeenCalled());
      const decoded = decodeURIComponent(openURL.mock.calls[0][0]);
      expect(decoded).not.toContain('case-1');
    });

    it('muestra el número para copiar cuando no se puede abrir WhatsApp', async () => {
      openURL.mockRejectedValue(new Error('no handler'));
      await renderCard(paidRequest('+5491155554444'));

      fireEvent.press(screen.getByText(i18n.t('lawyer.handoff.action')));

      await screen.findByText(i18n.t('lawyer.handoff.unavailable'));
      expect(screen.getByText('+5491155554444')).toBeTruthy();
      expect(screen.getByText(i18n.t('lawyer.handoff.copy'))).toBeTruthy();
    });
  });

  describe('sin el número del estudio', () => {
    it('dice que falta el dato en vez de ofrecer un botón muerto', async () => {
      await renderCard(paidRequest(null));

      // Mismo criterio que el alcance pendiente del modal: el bloqueo se ve.
      expect(screen.queryByText(i18n.t('lawyer.handoff.action'))).toBeNull();
      expect(
        screen.getByText(i18n.t('lawyer.handoff.numberPending', { code: 'lawreq-0007' })),
      ).toBeTruthy();
    });

    it('igual le deja el número de solicitud a la vista', async () => {
      await renderCard(paidRequest(null));
      expect(screen.getByText(/lawreq-0007/)).toBeTruthy();
    });
  });

  it('usa la config local cuando el payload todavía no trae número', async () => {
    // Mientras el endpoint no exista, EXPO_PUBLIC_ESTUDIO_WHATSAPP es el
    // respaldo. Cuando exista, el payload gana.
    mockEnvNumber = '+5491133334444';
    await renderCard(paidRequest(null));

    fireEvent.press(screen.getByText(i18n.t('lawyer.handoff.action')));

    await waitFor(() => expect(openURL).toHaveBeenCalled());
    expect(openURL.mock.calls[0][0]).toContain('https://wa.me/5491133334444');
  });
});
