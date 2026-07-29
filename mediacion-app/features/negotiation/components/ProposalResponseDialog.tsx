import { ConfirmationDialog } from '../../../design-system';
import type { ButtonVariant } from '../../../design-system/components/Button';

export type ProposalResponseDialogProps = {
  visible: boolean;
  status: 'idle' | 'submitting' | 'error';
  title: string;
  body: string;
  confirmLabel: string;
  confirmVariant: ButtonVariant;
  cancelLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirms an accept/reject decision before it's submitted. The response
 * itself is immutable once submitted, so this is the one chance to back out.
 */
export function ProposalResponseDialog({
  visible,
  status,
  title,
  body,
  confirmLabel,
  confirmVariant,
  cancelLabel,
  errorTitle,
  retryLabel,
  onConfirm,
  onCancel,
}: ProposalResponseDialogProps) {
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="file-signature"
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
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
