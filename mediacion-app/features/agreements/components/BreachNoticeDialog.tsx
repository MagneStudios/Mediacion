import { ConfirmationDialog } from '../../../design-system';

export type BreachNoticeDialogStatus = 'idle' | 'submitting' | 'error';

export type BreachNoticeDialogProps = {
  visible: boolean;
  status: BreachNoticeDialogStatus;
  title: string;
  /** Already fully composed by the caller (e.g. via i18next interpolation) — never string-concatenated here. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirms a breach-notice registration before it happens — this is the
 * one action in the app that references the other party's conduct, so an
 * explicit, named confirmation is required rather than a single tap. Uses
 * the neutral (non-destructive) confirm styling: this records a dated
 * note, it does not delete anything or assign fault.
 */
export function BreachNoticeDialog({
  visible,
  status,
  title,
  body,
  confirmLabel,
  cancelLabel,
  errorTitle,
  retryLabel,
  onConfirm,
  onCancel,
}: BreachNoticeDialogProps) {
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="alert-circle"
      confirmLabel={confirmLabel}
      confirmVariant="primary"
      onConfirm={onConfirm}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      loading={status === 'submitting'}
      errorTitle={status === 'error' ? errorTitle : undefined}
      retryLabel={retryLabel}
    >
      {body}
    </ConfirmationDialog>
  );
}
