import type { MockProfile, NotificationPreferences } from '../types/profile';

/**
 * Deterministic seed for the single authenticated "party-self" persona used
 * throughout this app (see services/positions.service.ts's MOCK_OWNER_ID).
 * A fictional demo name — never real personal data, since there is no real
 * authentication in this phase.
 */
export function buildInitialProfile(): MockProfile {
  return {
    nombre: 'Julieta',
    apellido: 'Fernández',
    rol: 'parte',
    idioma: 'es',
    activo: true,
    communicationPreference: 'email_summary',
    accessibilityPreference: 'system_default',
  };
}

/** All categories on by default except general product-update announcements. Deterministic — no randomness. */
export function buildInitialNotificationPreferences(): NotificationPreferences {
  return {
    caseUpdates: true,
    proposalReady: true,
    responseReceived: true,
    signatureReady: true,
    agreementCompleted: true,
    mediatorAvailability: true,
    productUpdates: false,
  };
}
