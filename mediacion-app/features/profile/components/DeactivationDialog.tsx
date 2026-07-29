import { ConfirmationDialog } from '../../../design-system';

export type DeactivationDialogProps = {
  visible: boolean;
  status: 'idle' | 'pending' | 'error';
  /** True once a request already exists (first success or a repeat open) — swaps the confirm ask for the idempotent "already registered" notice. */
  alreadyRequested: boolean;
  title: string;
  body: string;
  alreadyRequestedTitle: string;
  alreadyRequestedBody: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
};

/**
 * The account-deactivation request confirmation. Uses the restrained
 * `destructive` treatment only for the confirm action itself — this is the
 * one place in profile/settings where that styling belongs. Once a request
 * already exists, swaps to a single acknowledgement action instead of a
 * confirm/cancel pair.
 */
export function DeactivationDialog({
  visible,
  status,
  alreadyRequested,
  title,
  body,
  alreadyRequestedTitle,
  alreadyRequestedBody,
  confirmLabel,
  cancelLabel,
  closeLabel,
  errorTitle,
  retryLabel,
  onConfirm,
  onCancel,
  onClose,
}: DeactivationDialogProps) {
  if (alreadyRequested) {
    return (
      <ConfirmationDialog
        visible={visible}
        title={alreadyRequestedTitle}
        icon="alert-circle"
        destructive
        confirmLabel={closeLabel}
        confirmVariant="tertiary"
        onConfirm={onClose}
        onDismiss={onClose}
      >
        {alreadyRequestedBody}
      </ConfirmationDialog>
    );
  }

  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="alert-circle"
      destructive
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
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
