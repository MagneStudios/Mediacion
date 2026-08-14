import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import i18n from '@/i18n';
import type { LegalDocument } from '@/types/legal';

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockGetAcceptanceStatus = jest.fn();
const mockGetCurrentDocument = jest.fn();
const mockRegisterAcceptance = jest.fn();
jest.mock('@/services/legal.service', () => ({
  legalService: {
    getAcceptanceStatus: (...args: unknown[]) => mockGetAcceptanceStatus(...args),
    getCurrentDocument: (...args: unknown[]) => mockGetCurrentDocument(...args),
    registerAcceptance: (...args: unknown[]) => mockRegisterAcceptance(...args),
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
});
