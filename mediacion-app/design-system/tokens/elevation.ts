import type { ViewStyle } from 'react-native';

/**
 * Mediación elevation tokens — ported from tokens/elevation.css. The system
 * resists drop shadows: depth is a surface change (white card on cream), not
 * a shadow. Shadows are reserved for transient overlays (dialogs, popovers) —
 * never resting cards. RN has no CSS box-shadow, so overlay/popover are
 * expressed as cross-platform ViewStyle (iOS shadow* + Android elevation).
 */
export const shadows: Record<'card' | 'overlay' | 'popover', ViewStyle> = {
  card: {},
  overlay: {
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 12,
  },
  popover: {
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
};

/** Focus state is communicated by border color (see colors.semanticColors.border.focus), not a native box-shadow ring. */
export const focusBorderWidth = 1.5;
