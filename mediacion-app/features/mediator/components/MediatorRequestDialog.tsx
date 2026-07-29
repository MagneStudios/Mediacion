import { ConfirmationDialog } from '../../../design-system';

export type MediatorRequestDialogProps = {
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
 * Confirms a mocked mediator-accompaniment request before it's submitted.
 * Once committed, a mediation record is immutable in this phase (no
 * cancellation anywhere in this feature), so this is the one chance to
 * back out. Confirm uses the neutral secondary variant — mediator actions
 * never use the sage "ai" treatment.
 */
export function MediatorRequestDialog({
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
}: MediatorRequestDialogProps) {
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="scale"
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
