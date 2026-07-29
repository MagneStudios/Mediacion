import { ConfirmationDialog } from '../../../design-system';

export type SimulateInvitationAcceptanceDialogProps = {
  visible: boolean;
  status: 'idle' | 'submitting' | 'error';
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirms the phase-9 demo-only "simulate invitation acceptance" action.
 * This only ever updates the local mock demo; no real invitation is sent or
 * accepted.
 */
export function SimulateInvitationAcceptanceDialog({
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
}: SimulateInvitationAcceptanceDialogProps) {
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="send"
      confirmLabel={confirmLabel}
      confirmVariant="secondary"
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
