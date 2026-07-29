import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon } from '../../../design-system';
import type { ButtonVariant } from '../../../design-system/components/Button';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { shadows } from '../../../design-system/tokens/elevation';
import { getModalMaxWidth } from '../../../design-system/tokens/layout';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { useResponsiveLayout } from '../../../hooks/use-responsive-layout';

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
 * Confirms an accept/reject decision before it's submitted — a native
 * Modal, mirroring DeletePositionDialog's structure. The response itself is
 * immutable once submitted, so this is the one chance to back out.
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
  const { isWide } = useResponsiveLayout();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.panel, { maxWidth: getModalMaxWidth(isWide) }]} accessibilityRole="alert" accessible>
          <View style={styles.iconCircle}>
            <Icon name="file-signature" size={22} color={semanticColors.text.secondary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          {status === 'error' ? (
            <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onConfirm} />
          ) : (
            <View style={styles.actions}>
              <Button variant={confirmVariant} fullWidth onPress={onConfirm} loading={status === 'submitting'}>
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
