import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { shadows } from '../../../design-system/tokens/elevation';
import { getModalMaxWidth } from '../../../design-system/tokens/layout';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { useResponsiveLayout } from '../../../hooks/use-responsive-layout';

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
 * Native Modal for the account-deactivation request. Uses the restrained
 * `destructive` Button treatment only for the confirm action itself — this
 * is the one place in profile/settings where that styling belongs.
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
  const { isWide } = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={alreadyRequested ? onClose : onCancel}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.panel, { maxWidth: getModalMaxWidth(isWide) }]} accessibilityRole="alert" accessible>
          <View style={styles.iconCircle}>
            <Icon name="alert-circle" size={22} color={semanticColors.status.errorFg} />
          </View>

          {alreadyRequested ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {alreadyRequestedTitle}
              </Text>
              <Text style={styles.body}>{alreadyRequestedBody}</Text>
              <View style={styles.actions}>
                <Button variant="tertiary" fullWidth onPress={onClose}>
                  {closeLabel}
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Text style={styles.body}>{body}</Text>
              {status === 'error' ? (
                <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onConfirm} />
              ) : (
                <View style={styles.actions}>
                  <Button variant="destructive" fullWidth onPress={onConfirm} loading={status === 'pending'}>
                    {confirmLabel}
                  </Button>
                  <Button variant="tertiary" fullWidth onPress={onCancel} disabled={status === 'pending'}>
                    {cancelLabel}
                  </Button>
                </View>
              )}
            </>
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
    maxHeight: '90%',
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
    backgroundColor: semanticColors.status.errorBg,
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
