import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { shadows } from '../../../design-system/tokens/elevation';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

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

/** Native Modal confirmation — a simulated sign-out is still an explicit, named confirmation, never a silent action. */
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.panel} accessibilityRole="alert" accessible>
          <View style={styles.iconCircle}>
            <Icon name="log-out" size={22} color={semanticColors.text.secondary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          {status === 'error' ? (
            <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onConfirm} />
          ) : (
            <View style={styles.actions}>
              <Button variant="primary" fullWidth onPress={onConfirm} disabled={status === 'pending'}>
                {confirmLabel}
              </Button>
              <Button variant="tertiary" fullWidth onPress={onCancel} disabled={status === 'pending'}>
                {cancelLabel}
              </Button>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: semanticColors.surface.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.popover,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: semanticColors.surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  body: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: semanticColors.text.secondary,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
