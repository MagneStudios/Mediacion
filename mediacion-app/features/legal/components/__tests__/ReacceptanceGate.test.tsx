import { I18nextProvider } from 'react-i18next';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import i18n from '@/i18n';
import type { LegalDocument } from '@/types/legal';

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockGetAcceptanceStatus = jest.fn();
const mockGetCurrentDocument = jest.fn();
const mockRegisterAcceptance = jest.fn();
const mockGetScheduledDocument = jest.fn();
jest.mock('@/services/legal.service', () => ({
  legalService: {
    getAcceptanceStatus: (...args: unknown[]) => mockGetAcceptanceStatus(...args),
    getCurrentDocument: (...args: unknown[]) => mockGetCurrentDocument(...args),
    registerAcceptance: (...args: unknown[]) => mockRegisterAcceptance(...args),
    getScheduledDocument: (...args: unknown[]) => mockGetScheduledDocument(...args),
  },
}));

// eslint-disable-next-line import/first
import { ReacceptanceGate } from '../ReacceptanceGate';

const substantialV2: LegalDocument = {
  tipo: 'terms',
  version: 'v2.0',
  contenido: '## A. NUEVO TEXTO\n\nA.1. Cláusula nueva.',
  validFrom: '2026-09-01T00:00:00.000Z',
  validTo: null,
  isSubstantial: true,
  resumenCambios: 'Cambió cómo se cobra el servicio.',
};

async function renderGate() {
  await render(
    <I18nextProvider i18n={i18n}>
      <ReacceptanceGate>
        <Text>APP CONTENT</Text>
      </ReacceptanceGate>
    </I18nextProvider>,
  );
}

describe('ReacceptanceGate', () => {
  beforeEach(() => {
    mockGetAcceptanceStatus.mockReset();
    mockGetCurrentDocument.mockReset();
    mockRegisterAcceptance.mockReset();
    mockGetScheduledDocument.mockReset();
    mockGetScheduledDocument.mockResolvedValue(undefined);
  });

  it('stays out of the way when nothing substantial is pending', async () => {
    mockGetAcceptanceStatus.mockResolvedValue({ pendientes: [], requiereReaceptacion: false });
    await renderGate();

    await waitFor(() => expect(mockGetAcceptanceStatus).toHaveBeenCalled());
    expect(screen.getByText('APP CONTENT')).toBeTruthy();
    expect(screen.queryByText(i18n.t('legal.reacceptance.title'))).toBeNull();
  });

  it('blocks with the new text and the plain-language summary when a substantial change is pending', async () => {
    mockGetAcceptanceStatus.mockResolvedValue({ pendientes: ['terms'], requiereReaceptacion: true });
    mockGetCurrentDocument.mockResolvedValue(substantialV2);
    await renderGate();

    await waitFor(() => expect(screen.getByText(i18n.t('legal.reacceptance.title'))).toBeTruthy());
    expect(screen.getByText('Cambió cómo se cobra el servicio.')).toBeTruthy();
    expect(screen.getByText('A.1. Cláusula nueva.')).toBeTruthy();
  });

  it('accepting registers WITHOUT a marketing field and unblocks the app', async () => {
    mockGetAcceptanceStatus.mockResolvedValue({ pendientes: ['terms'], requiereReaceptacion: true });
    mockGetCurrentDocument.mockResolvedValue(substantialV2);
    mockRegisterAcceptance.mockResolvedValue(undefined);
    await renderGate();
    await waitFor(() => expect(screen.getByText(i18n.t('legal.reacceptance.acceptAction'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('legal.reacceptance.acceptAction')));

    // Re-acceptance must not rewrite the marketing choice made at signup.
    await waitFor(() => expect(mockRegisterAcceptance).toHaveBeenCalledWith({}));
    await waitFor(() => expect(screen.queryByText(i18n.t('legal.reacceptance.title'))).toBeNull());
  });

  it('fails open when the status check errors — the DB constraint is the real enforcement', async () => {
    mockGetAcceptanceStatus.mockRejectedValue(new Error('network'));
    await renderGate();

    await waitFor(() => expect(mockGetAcceptanceStatus).toHaveBeenCalled());
    expect(screen.getByText('APP CONTENT')).toBeTruthy();
    expect(screen.queryByText(i18n.t('legal.reacceptance.title'))).toBeNull();
  });

  /**
   * A long-lived web tab: the initial check passes, a substantial version is
   * scheduled, and `validFrom` arrives with the app still open. The gate must
   * not need a remount to start blocking — it re-runs `getAcceptanceStatus`
   * when the scheduled version enters into force.
   */
  describe('re-check when a scheduled version enters into force', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-31T23:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('re-consults the acceptance status and blocks on a pending substantial version', async () => {
      mockGetAcceptanceStatus.mockResolvedValue({ pendientes: [], requiereReaceptacion: false });
      // Scheduled one hour ahead of the pinned clock (validFrom 2026-09-01T00:00Z).
      mockGetScheduledDocument.mockImplementation((tipo: string) =>
        Promise.resolve(tipo === 'terms' ? substantialV2 : undefined),
      );
      await renderGate();
      await act(async () => {});
      expect(screen.getByText('APP CONTENT')).toBeTruthy();
      expect(screen.queryByText(i18n.t('legal.reacceptance.title'))).toBeNull();

      // The version enters into force: the status flips to pending and the
      // scheduled read empties out.
      mockGetAcceptanceStatus.mockResolvedValue({ pendientes: ['terms'], requiereReaceptacion: true });
      mockGetCurrentDocument.mockResolvedValue(substantialV2);
      mockGetScheduledDocument.mockResolvedValue(undefined);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });
      await act(async () => {});

      expect(mockGetAcceptanceStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText(i18n.t('legal.reacceptance.title'))).toBeTruthy();
    });

    it('stays open when the re-check errors — never blocks on a failure', async () => {
      mockGetAcceptanceStatus.mockResolvedValueOnce({ pendientes: [], requiereReaceptacion: false });
      mockGetScheduledDocument.mockImplementation((tipo: string) =>
        Promise.resolve(tipo === 'terms' ? substantialV2 : undefined),
      );
      await renderGate();
      await act(async () => {});

      mockGetAcceptanceStatus.mockRejectedValue(new Error('network'));
      mockGetScheduledDocument.mockResolvedValue(undefined);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });
      await act(async () => {});

      expect(mockGetAcceptanceStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText('APP CONTENT')).toBeTruthy();
      expect(screen.queryByText(i18n.t('legal.reacceptance.title'))).toBeNull();
    });

    it('KEEPS blocking when a re-check errors — a transient failure never dissolves an established block', async () => {
      // Fail-open is only for a gate that never blocked: here the block is
      // already up, and a network hiccup on the re-check must not tear down a
      // mandatory re-acceptance.
      mockGetAcceptanceStatus.mockResolvedValueOnce({ pendientes: ['terms'], requiereReaceptacion: true });
      mockGetCurrentDocument.mockResolvedValue(substantialV2);
      mockGetScheduledDocument.mockImplementation((tipo: string) =>
        Promise.resolve(tipo === 'terms' ? substantialV2 : undefined),
      );
      await renderGate();
      await act(async () => {});
      expect(screen.getByText(i18n.t('legal.reacceptance.title'))).toBeTruthy();

      mockGetAcceptanceStatus.mockRejectedValue(new Error('network'));
      mockGetScheduledDocument.mockResolvedValue(undefined);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });
      await act(async () => {});

      expect(mockGetAcceptanceStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText(i18n.t('legal.reacceptance.title'))).toBeTruthy();
    });

    it('re-arms a grace re-check when the scheduled read returns only versions this clock already considers past', async () => {
      // Client clock behind the server: the server-side filter says
      // "scheduled" while Date.now() says "already in force". Dying in
      // silence would mean never re-checking; the grace timer retries until
      // the read empties out or the clocks agree.
      mockGetAcceptanceStatus.mockResolvedValueOnce({ pendientes: [], requiereReaceptacion: false });
      const skewedPast = { ...substantialV2, validFrom: '2026-08-31T22:00:00.000Z' };
      mockGetScheduledDocument.mockImplementation((tipo: string) =>
        Promise.resolve(tipo === 'terms' ? skewedPast : undefined),
      );
      await renderGate();
      await act(async () => {});
      expect(mockGetAcceptanceStatus).toHaveBeenCalledTimes(1);

      mockGetAcceptanceStatus.mockResolvedValue({ pendientes: ['terms'], requiereReaceptacion: true });
      mockGetCurrentDocument.mockResolvedValue(substantialV2);
      mockGetScheduledDocument.mockResolvedValue(undefined);

      await act(async () => {
        jest.advanceTimersByTime(60 * 1000);
      });
      await act(async () => {});

      expect(mockGetAcceptanceStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText(i18n.t('legal.reacceptance.title'))).toBeTruthy();
    });

    it('never fires a re-check while accept() is in flight — the check must not race the acceptance', async () => {
      mockGetAcceptanceStatus.mockResolvedValueOnce({ pendientes: ['terms'], requiereReaceptacion: true });
      mockGetCurrentDocument.mockResolvedValue(substantialV2);
      mockGetScheduledDocument.mockImplementation((tipo: string) =>
        Promise.resolve(tipo === 'terms' ? substantialV2 : undefined),
      );
      let resolveAcceptance: (() => void) | undefined;
      mockRegisterAcceptance.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveAcceptance = resolve;
          }),
      );
      await renderGate();
      await act(async () => {});
      expect(screen.getByText(i18n.t('legal.reacceptance.acceptAction'))).toBeTruthy();

      fireEvent.press(screen.getByText(i18n.t('legal.reacceptance.acceptAction')));
      await act(async () => {});
      expect(mockRegisterAcceptance).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });
      await act(async () => {});
      expect(mockGetAcceptanceStatus).toHaveBeenCalledTimes(1);

      // Real timers for the resolution tail: under fake timers the promise
      // polyfill schedules accept()'s continuation through faked macrotasks
      // and the unblock never reaches the tree. The guard itself was already
      // asserted above; this only proves the skip didn't strand the gate.
      jest.useRealTimers();
      await act(async () => {
        resolveAcceptance?.();
      });
      await waitFor(() =>
        expect(screen.queryByText(i18n.t('legal.reacceptance.title'))).toBeNull(),
      );
    });
  });
});
