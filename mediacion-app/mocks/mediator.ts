import type { SharedMediatorProfile } from '../types/mediator';

/**
 * A single fictional, clearly-mock mediator profile shared by every
 * assigned case in this demo — there is no backend mediator-profile table
 * to seed from (see types/mediator.ts). Never a real professional; never
 * implies verified credentials, a license/matrícula, a rating, or an
 * organization. `id` is internal-only — never rendered, never routed.
 */
export function buildMockMediatorProfile(): SharedMediatorProfile {
  return {
    id: 'mediator-profile-demo-1',
    displayName: 'Lucía Fernández',
    roleLabelKey: 'mediator.profile.roleLabel',
    summaryKey: 'mediator.profile.summaryText',
    languageCodes: ['es', 'en'],
  };
}
