import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { radii } from '../tokens/radii';
import { semanticColors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

import { Icon } from './Icon';

// Keyboard focus-visible ring for web, mirroring Button.tsx's approach —
// CSS pseudo-class injected once at module scope; native is a no-op.
if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'checkbox-focus-visible');
    styleTag.textContent =
      `[data-testid="mediacion-checkbox"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser — safe no-op */
  }
}

export type CheckboxProps = {
  /**
   * Fully controlled, and deliberately without any default or
   * `defaultChecked` escape hatch: a legal-acceptance checkbox must never be
   * able to start life pre-ticked (instructivo TyC §2), so the component
   * simply has no way to express that.
   */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * ReactNode, not string: acceptance labels embed inline links ("Leí y
   * acepto los <Términos>"), which must be tappable without toggling the box.
   */
  label: ReactNode;
  disabled?: boolean;
  accessibilityLabel: string;
};

const boxSize = 22;

/** Plain checkbox. The box toggles; the label is its own touch surface so inline links stay tappable. */
export function Checkbox({ checked, onChange, label, disabled = false, accessibilityLabel }: CheckboxProps) {
  return (
    <View style={styles.row}>
      <Pressable
        testID="mediacion-checkbox"
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        // RN-web 0.21 does not derive aria-checked from accessibilityState;
        // without it a screen reader on web hears a checkbox with no state.
        // Native ignores this prop in favor of accessibilityState.
        aria-checked={checked}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        // The 22px box alone is under every touch-target guideline; the
        // padded hit slop brings it to ~44px without moving the layout.
        hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
        style={({ pressed }) => [
          styles.box,
          checked ? styles.boxChecked : null,
          disabled ? styles.boxDisabled : null,
          pressed && !disabled ? styles.boxPressed : null,
        ]}
      >
        {checked ? <Icon name="check" size={15} color={semanticColors.action.primaryFg} /> : null}
      </Pressable>
      <View style={styles.label}>{label}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  box: {
    width: boxSize,
    height: boxSize,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: semanticColors.border.strong,
    backgroundColor: semanticColors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    // Optically align the box with the first line of a multi-line label.
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: semanticColors.action.primaryBg,
    borderColor: semanticColors.action.primaryBg,
  },
  boxPressed: {
    borderColor: semanticColors.border.focus,
  },
  boxDisabled: {
    opacity: 0.5,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
});
