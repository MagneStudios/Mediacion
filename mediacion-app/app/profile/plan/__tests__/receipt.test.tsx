import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { MockInvoice } from '@/types/billing';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ subscriptionId: 'sub-1' }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockGetInvoiceForSubscription = jest.fn();
const mockPrepareInvoiceDownload = jest.fn();
jest.mock('@/services/billing.service', () => ({
  billingService: {
    getInvoiceForSubscription: (...args: unknown[]) => mockGetInvoiceForSubscription(...args),
    prepareInvoiceDownload: (...args: unknown[]) => mockPrepareInvoiceDownload(...args),
  },
}));

// eslint-disable-next-line import/first
import PlanReceiptScreen from '../receipt';

const invoice: MockInvoice = {
  id: 'inv-1',
  pagoId: 'pay-1',
  numero: null,
  cae: null,
  urlPdf: null,
  neto: 25,
  iva: 5.25,
  impuestos: 0,
  total: 30.25,
  moneda: 'ARS',
  estado: 'emitida',
  createdAt: '2026-08-10T00:00:00.000Z',
};

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <PlanReceiptScreen />
    </I18nextProvider>,
  );
}

describe('PlanReceiptScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockGetInvoiceForSubscription.mockReset();
    mockPrepareInvoiceDownload.mockReset();
  });

  it('shows the not-found error when there is no invoice for the subscription', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue(null);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.notFound.title'))).toBeTruthy());
  });

  it('shows the invoice breakdown', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue(invoice);
    await renderScreen();
    await waitFor(() => expect(screen.getByText('ARS\u00a030.25')).toBeTruthy());
    expect(screen.getByText('ARS\u00a025.00')).toBeTruthy();
    expect(screen.getByText('ARS\u00a05.25')).toBeTruthy();
  });

  it('never fabricates a comprobante numero when none was assigned (no ARCA credentials yet)', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue(invoice);
    await renderScreen();
    await waitFor(() => expect(screen.getByText('ARS\u00a030.25')).toBeTruthy());
    expect(screen.queryByText(/Comprobante N/)).toBeNull();
    expect(screen.queryByText(/Receipt No/)).toBeNull();
  });

  it('shows the assigned numero when one exists', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue({ ...invoice, numero: '0001-00000123' });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.numero', { numero: '0001-00000123' }))).toBeTruthy());
  });

  it('downloading never touches a real file — success copy says so explicitly', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue(invoice);
    mockPrepareInvoiceDownload.mockResolvedValue(undefined);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.downloadAction'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('billing.receipt.downloadAction')));

    await waitFor(() => expect(mockPrepareInvoiceDownload).toHaveBeenCalledWith('inv-1'));
    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.downloadSuccess.title'))).toBeTruthy());
    expect(screen.getByText(i18n.t('billing.receipt.downloadSuccess.body'))).toBeTruthy();
  });

  it('shows a recoverable error when preparing the download fails', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue(invoice);
    mockPrepareInvoiceDownload.mockRejectedValue(new Error('mock_invoice_download_failed'));
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.downloadAction'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('billing.receipt.downloadAction')));

    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.downloadError.title'))).toBeTruthy());
  });

  it('navigates back to my plan', async () => {
    mockGetInvoiceForSubscription.mockResolvedValue(invoice);
    await renderScreen();
    await waitFor(() => expect(screen.getByText(i18n.t('billing.receipt.backToPlanAction'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('billing.receipt.backToPlanAction')));
    expect(mockPush).toHaveBeenCalledWith('/profile/plan');
  });
});
