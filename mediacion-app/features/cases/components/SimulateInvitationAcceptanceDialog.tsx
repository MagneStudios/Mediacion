import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { shadows } from '../../../design-system/tokens/elevation';
import { getModalMaxWidth } from '../../../design-system/tokens/layout';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { useResponsiveLayout } from '../../../hooks/use-responsive-layout';

export type SimulateInvitationAcceptanceDialogProps = {
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
 * Confirms the phase-9 demo-only "simulate invitation acceptance" action —
 * a native Modal mirroring ProposalResponseDialog/MediatorRequestDialog's
 * structure exactly. This only ever updates the local mock demo; no real
 * invitation is sent or accepted.
 */
export function SimulateInvitationAcceptanceDialog({
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
}: SimulateInvitationAcceptanceDialogProps) {
  const { isWide } = useResponsiveLayout();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.panel, { maxWidth: getModalMaxWidth(isWide) }]} accessibilityRole="alert" accessible>
          <View style={styles.iconCircle}>
            <Icon name="send" size={22} color={semanticColors.text.secondary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          {status === 'error' ? (
            <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onConfirm} />
          ) : (
            <View style={styles.actions}>
              <Button variant="secondary" fullWidth onPress={onConfirm} loading={status === 'submitting'}>
                {confirmLabel}
              </Button>
              <Button variant="tertiary" fullWidth onPress={onCancel} disabled={status === 'submitting'}>
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
