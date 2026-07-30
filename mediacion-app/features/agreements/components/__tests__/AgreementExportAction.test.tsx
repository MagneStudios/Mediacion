import { render, screen } from '@testing-library/react-native';

import { AgreementExportAction } from '../AgreementExportAction';

describe('AgreementExportAction', () => {
  const baseProps = {
    onExport: jest.fn(),
    actionLabel: 'Export agreement',
    exportingTitle: 'Preparing the exported file',
    exportingBody: 'The plain-text file will be ready in a moment.',
    successTitle: 'Agreement exported',
    successBody: 'A plain-text summary was generated in this test environment.',
    errorTitle: "We couldn't export the agreement",
    retryLabel: 'Retry',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('idle', () => {
    it('renders the export action button', async () => {
      await render(<AgreementExportAction {...baseProps} status="idle" />);
      expect(screen.getByRole('button', { name: 'Export agreement' })).toBeTruthy();
    });

    it('calls onExport when pressed', async () => {
      const onExport = jest.fn();
      await render(<AgreementExportAction {...baseProps} status="idle" onExport={onExport} />);
      screen.getByRole('button', { name: 'Export agreement' }).props.onClick?.({} as never);
      expect(onExport).toHaveBeenCalledTimes(1);
    });
  });

  describe('pending', () => {
    it('renders the document-preparation state with the exporting copy', async () => {
      await render(<AgreementExportAction {...baseProps} status="pending" />);
      expect(screen.getByText('Preparing the exported file')).toBeTruthy();
      expect(screen.getByText('The plain-text file will be ready in a moment.')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('success', () => {
    it('renders the success copy instead of the action button', async () => {
      await render(<AgreementExportAction {...baseProps} status="success" />);
      expect(screen.getByText('Agreement exported')).toBeTruthy();
      expect(screen.getByText('A plain-text summary was generated in this test environment.')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('error', () => {
    it('renders the error state with a retry action', async () => {
      await render(<AgreementExportAction {...baseProps} status="error" />);
      expect(screen.getByText("We couldn't export the agreement")).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('calls onRetry when retrying, falling back to onExport when onRetry is absent', async () => {
      const onExport = jest.fn();
      await render(<AgreementExportAction {...baseProps} status="error" onExport={onExport} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('prefers onRetry over onExport when both are provided', async () => {
      const onExport = jest.fn();
      const onRetry = jest.fn();
      await render(<AgreementExportAction {...baseProps} status="error" onExport={onExport} onRetry={onRetry} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onExport).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('renders a disabled button with the disabled reason, regardless of status', async () => {
      await render(
        <AgreementExportAction {...baseProps} status="idle" disabled disabledReason="Exporting isn't available yet." />,
      );
      const button = screen.getByRole('button', { name: 'Export agreement' });
      expect(button.props.accessibilityState.disabled).toBe(true);
      expect(screen.getByText("Exporting isn't available yet.")).toBeTruthy();
    });

    it('does not call onExport when disabled and pressed', async () => {
      const onExport = jest.fn();
      await render(<AgreementExportAction {...baseProps} status="idle" onExport={onExport} disabled />);
      screen.getByRole('button', { name: 'Export agreement' }).props.onClick?.({} as never);
      expect(onExport).not.toHaveBeenCalled();
    });

    it('renders no disabled reason text when none is provided', async () => {
      await render(<AgreementExportAction {...baseProps} status="idle" disabled />);
      expect(screen.queryByText("Exporting isn't available yet.")).toBeNull();
    });
  });

  describe('copy', () => {
    it('never mentions PDF or a signed document in any state', async () => {
      const statuses = ['idle', 'pending', 'success', 'error'] as const;
      for (const status of statuses) {
        const { unmount } = await render(<AgreementExportAction {...baseProps} status={status} />);
        expect(screen.queryByText(/pdf/i)).toBeNull();
        expect(screen.queryByText(/signed document/i)).toBeNull();
        await unmount();
      }
    });
  });
});
