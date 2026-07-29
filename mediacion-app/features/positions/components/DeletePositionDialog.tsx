import { ConfirmationDialog } from '../../../design-system';

export type DeletePositionDialogProps = {
  visible: boolean;
  status: 'idle' | 'deleting' | 'error';
  title: string;
  /** Already fully composed by the caller via i18next interpolation (e.g. t('positions.delete.body', { name })) — never string-concatenated here. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Deletion requires an explicit, named confirmation — never a swipe gesture.
 * A modal (not a route) keeps the destructive action anchored to the list
 * item it refers to.
 */
export function DeletePositionDialog({
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
}: DeletePositionDialogProps) {
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      icon="trash-2"
      destructive
      confirmLabel={confirmLabel}
      confirmVariant="destructive"
      onConfirm={onConfirm}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      loading={status === 'deleting'}
      errorTitle={status === 'error' ? errorTitle : undefined}
      retryLabel={retryLabel}
    >
      {body}
    </ConfirmationDialog>
  );
}
