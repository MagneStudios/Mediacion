import { ConfirmationDialog } from '../../../design-system';

export type SignOutDialogProps = {
  visible: boolean;
  status: 'idle' | 'pending' | 'error';
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A simulated sign-out is still an explicit, named confirmation, never a silent action. */
export function SignOutDialog({
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
}: SignOutDialogProps) {
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="log-out"
      confirmLabel={confirmLabel}
      confirmVariant="primary"
      onConfirm={onConfirm}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      loading={status === 'pending'}
      errorTitle={status === 'error' ? errorTitle : undefined}
      retryLabel={retryLabel}
    >
      {body}
    </ConfirmationDialog>
  );
}
