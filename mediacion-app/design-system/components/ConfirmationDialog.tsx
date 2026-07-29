import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/elevation';
import { getModalMaxWidth } from '../tokens/layout';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';
import { useResponsiveLayout } from '../../hooks/use-responsive-layout';
import { Button, type ButtonVariant } from './Button';
import { ErrorState } from './ErrorState';
import { Icon, type IconName } from './Icon';

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  /** Body content — plain translated copy, one to a few sentences. */
  children: ReactNode;
  icon: IconName;
  /** Tints the icon circle with the restrained error palette instead of the neutral one. */
  destructive?: boolean;
  confirmLabel: string;
  confirmVariant: ButtonVariant;
  onConfirm: () => void;
  /** Omit together with `onCancel` for a single-action (acknowledgement-only) dialog. */
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Presence swaps the actions row for an ErrorState whose retry re-invokes onConfirm. */
  errorTitle?: string;
  retryLabel?: string;
  /** Hardware/backdrop dismiss handler — defaults to onCancel. */
  onDismiss?: () => void;
};

/**
 * Shared confirmation-modal shell used by every feature's confirm/cancel
 * dialog (proposal response, mediator request, delete position, sign-out,
 * deactivation, simulated invitation acceptance). Owns only presentation —
 * layout, icon tinting, loading/error/disabled rendering — never feature
 * business logic, copy, or callback semantics.
 */
export function ConfirmationDialog({
  visible,
  title,
  children,
  icon,
  destructive = false,
  confirmLabel,
  confirmVariant,
  onConfirm,
  cancelLabel,
  onCancel,
  loading = false,
  disabled = false,
  errorTitle,
  retryLabel,
  onDismiss,
}: ConfirmationDialogProps) {
  const { isWide } = useResponsiveLayout();
  const panelRef = useRef<View>(null);

  // Web-only: focus trap, focus management, background aria-hidden isolation.
  // RN's Modal onRequestClose handles Escape natively; this effect only traps Tab.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const previousFocus = document.activeElement;

    const appRoot = document.getElementById('root');
    const previousRootAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    if (appRoot) appRoot.setAttribute('aria-hidden', 'true');

    const panelQuery = '[data-testid="mediacion-dialog-panel"]';
    const focusableQuery =
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])';

    const initialFocusFrame = requestAnimationFrame(() => {
      const panel = document.querySelector(panelQuery);
      if (!panel) return;
      const firstControl = panel.querySelector<HTMLElement>(focusableQuery);
      firstControl?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const panel = document.querySelector(panelQuery);
      if (!panel) return;

      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        const first = panel.querySelector<HTMLElement>(focusableQuery);
        first?.focus();
        return;
      }

      const focusable = panel.querySelectorAll<HTMLElement>(focusableQuery);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(initialFocusFrame);
      if (appRoot) {
        if (previousRootAriaHidden === null) {
          appRoot.removeAttribute('aria-hidden');
        } else {
          appRoot.setAttribute('aria-hidden', previousRootAriaHidden);
        }
      }
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss ?? onCancel}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          ref={panelRef}
          style={[styles.panel, { maxWidth: getModalMaxWidth(isWide) }]}
          accessibilityRole="alert"
          accessibilityLabel={title}
          testID="mediacion-dialog-panel"
        >
          <View style={[styles.iconCircle, destructive && styles.iconCircleDestructive]}>
            <Icon name={icon} size={22} color={destructive ? semanticColors.status.errorFg : semanticColors.text.secondary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{children}</Text>

          {errorTitle ? (
            <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onConfirm} />
          ) : (
            <View style={styles.actions}>
              <Button variant={confirmVariant} fullWidth onPress={onConfirm} loading={loading} disabled={disabled}>
                {confirmLabel}
              </Button>
              {cancelLabel && onCancel ? (
                <Button variant="tertiary" fullWidth onPress={onCancel} disabled={loading}>
                  {cancelLabel}
                </Button>
              ) : null}
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
  iconCircleDestructive: {
    backgroundColor: semanticColors.status.errorBg,
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
