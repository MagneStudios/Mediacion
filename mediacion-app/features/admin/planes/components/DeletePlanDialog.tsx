import { ConfirmationDialog } from '../../../../design-system';

export type DeletePlanDialogProps = {
  visible: boolean;
  status: 'idle' | 'deleting' | 'error';
  title: string;
  /** Already fully composed by the caller via i18next interpolation (e.g. t('admin.planes.delete.body', { nombre })) — never string-concatenated here. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  errorTitle: string;
  retryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Mirrors DeletePositionDialog exactly — deletion needs an explicit, named confirmation, never a swipe gesture. */
export function DeletePlanDialog({
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
}: DeletePlanDialogProps) {
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
