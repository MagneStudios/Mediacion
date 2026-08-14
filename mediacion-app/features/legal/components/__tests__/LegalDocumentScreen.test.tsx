import { I18nextProvider } from 'react-i18next';
import { render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { LegalDocument } from '@/types/legal';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockGetCurrentDocument = jest.fn();
jest.mock('@/services/legal.service', () => ({
  legalService: { getCurrentDocument: (...args: unknown[]) => mockGetCurrentDocument(...args) },
}));

// eslint-disable-next-line import/first
import { LegalDocumentScreen } from '../LegalDocumentScreen';

const document: LegalDocument = {
  tipo: 'terms',
  version: 'v1.0',
  contenido: '## A. DEFINICIONES\n\nA.1. Texto de prueba.',
  validFrom: '2026-08-13T00:00:00.000Z',
  validTo: null,
  isSubstantial: false,
  resumenCambios: null,
};

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <LegalDocumentScreen tipo="terms" title="Términos y Condiciones" />
    </I18nextProvider>,
  );
}

describe('LegalDocumentScreen', () => {
  beforeEach(() => {
    mockGetCurrentDocument.mockReset();
  });

  it('renders the document text and version from the data', async () => {
    mockGetCurrentDocument.mockResolvedValue(document);
    await renderScreen();

    await waitFor(() => expect(screen.getByText('A.1. Texto de prueba.')).toBeTruthy());
    expect(screen.getByText(i18n.t('legal.document.versionLabel', { version: 'v1.0' }))).toBeTruthy();
  });

  it('the last-updated date comes from validFrom — changing the data changes the screen, no deploy', async () => {
    mockGetCurrentDocument.mockResolvedValue(document);
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByText(/13 de agosto de 2026|August 13, 2026/)).toBeTruthy(),
    );
  });

  it('shows the empty state when no version is published', async () => {
    mockGetCurrentDocument.mockResolvedValue(undefined);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('legal.document.empty.title'))).toBeTruthy());
  });

  it('shows a recoverable error state when the fetch fails', async () => {
    mockGetCurrentDocument.mockRejectedValue(new Error('mock_get_legal_document_failed'));
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('legal.document.error.title'))).toBeTruthy());
    expect(screen.getByText(i18n.t('common.retry'))).toBeTruthy();
  });
});
