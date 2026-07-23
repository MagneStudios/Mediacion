/**
 * Mock-only identifier generators for the case-creation and position flows.
 * These are display tokens for a development sandbox, never real auth
 * material — see CaseInvitation.token. Not cryptographically secure by
 * design.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(length: number, alphabet: string): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

/** Short human-shareable invitation code, e.g. "K7P2QX". Mock-only. */
export function generateMockCode(): string {
  return randomString(6, CODE_ALPHABET);
}

/**
 * Mock invitation link using the app's own registered scheme (see app.json
 * "scheme": "mediacionapp") — not a real external domain, and not wired to
 * any deep-link handling in this phase. Clearly a dev-only placeholder.
 */
export function generateMockInvitationLink(): string {
  const token = randomString(10, CODE_ALPHABET).toLowerCase();
  return `mediacionapp://invitacion/mock-${token}`;
}

/** Mock case identifier for the in-memory session store. */
export function generateMockCaseId(): string {
  return `case-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock invitation identifier for the in-memory session store. */
export function generateMockInvitationId(): string {
  return `invitation-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock position-item identifier for the in-memory session store. */
export function generateMockPositionId(): string {
  return `position-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock negotiation-round identifier for the in-memory session store. */
export function generateMockRoundId(): string {
  return `round-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock shared-proposal identifier for the in-memory session store. */
export function generateMockProposalId(): string {
  return `proposal-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock shared-agreement identifier for the in-memory session store. */
export function generateMockAgreementId(): string {
  return `agreement-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock agreement-history-event identifier for the in-memory session store. */
export function generateMockHistoryId(): string {
  return `history-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock mediation-record identifier for the in-memory session store. */
export function generateMockMediationId(): string {
  return `mediation-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}

/** Mock mediator-activity-milestone identifier for the in-memory session store. */
export function generateMockMediatorEventId(): string {
  return `mediator-event-${Date.now()}-${randomString(4, CODE_ALPHABET).toLowerCase()}`;
}
