import { Button } from '../../../design-system/components/Button';

export type MarkAllReadActionProps = {
  label: string;
  pendingLabel: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
};

/** Thin Button wrapper for "Marcar todas como leídas" — disabled while pending, disabled entirely when there's nothing unread. */
export function MarkAllReadAction({ label, pendingLabel, onPress, disabled, pending }: MarkAllReadActionProps) {
  return (
    <Button variant="secondary" fullWidth onPress={onPress} disabled={disabled || pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
