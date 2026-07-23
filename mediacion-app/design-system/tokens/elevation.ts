import { Platform, type ViewStyle } from 'react-native';

/**
 * Mediación elevation tokens — ported from tokens/elevation.css. The system
 * resists drop shadows: depth is a surface change (white card on cream), not
 * a shadow. Shadows are reserved for transient overlays (dialogs, popovers) —
 * never resting cards. RN has no CSS box-shadow, so overlay/popover are
 * expressed as cross-platform ViewStyle (iOS shadow* + Android elevation).
 * RN Web deprecates the shadow* props in favor of `boxShadow`, so those two
 * tokens add a web-only `boxShadow` equivalent via Platform.select while
 * keeping the same shadow and elevation properties for native — same object
 * shape as before, just a platform-conditional addition.
 */
export const shadows: Record<'card' | 'overlay' | 'popover', ViewStyle> = {
  card: {},
  overlay: {
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 12,
    ...Platform.select({
      web: { boxShadow: '0 12px 32px -8px rgba(17, 17, 17, 0.16), 0 2px 8px -2px rgba(17, 17, 17, 0.08)' },
      default: {},
    }),
  },
  popover: {
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px -6px rgba(17, 17, 17, 0.14), 0 1px 4px -1px rgba(17, 17, 17, 0.08)' },
      default: {},
    }),
  },
};

/** Focus state is communicated by border color (see colors.semanticColors.border.focus), not a native box-shadow ring. */
export const focusBorderWidth = 1.5;
