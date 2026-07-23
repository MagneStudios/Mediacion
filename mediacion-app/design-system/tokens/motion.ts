import { Easing } from 'react-native';

/**
 * Mediación motion tokens — ported from tokens/elevation.css. Calm and short:
 * fades and gentle transitions, no bounce or spring. The AI-pending pulse
 * runs at 1.6s.
 */
export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
  aiPulse: 1600,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  out: Easing.bezier(0, 0, 0.2, 1),
} as const;
