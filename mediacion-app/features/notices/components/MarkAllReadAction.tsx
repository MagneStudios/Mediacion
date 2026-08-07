import { Button } from '../../../design-system/components/Button';

export type MarkAllReadActionProps = {
  label: string;
  pendingLabel: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  fullWidth?: boolean;
};

export function MarkAllReadAction({ label, pendingLabel, onPress, disabled, pending, fullWidth = true }: MarkAllReadActionProps) {
  return (
    <Button variant="primary" fullWidth={fullWidth} onPress={onPress} disabled={disabled || pending} loading={pending} loadingLabel={pendingLabel}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
