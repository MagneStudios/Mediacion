/**
 * Reconstructs the full `mediacionapp://invitacion/...` link from the
 * dynamic `[token]` segment expo-router captures for
 * `app/invitacion/[token].tsx` — `CaseInvitation.token` for a "link"
 * invitation is that whole string (see `generateMockInvitationLink`,
 * `utils/mock-id.ts`), not just the segment, so anywhere this needs to
 * match it has to rebuild it first.
 *
 * Shared between that screen and `AuthGate` (AJUSTES-PACTUM-2026-09-10,
 * puntos #2 y #4) — both need to hand the same reconstructed string
 * downstream to `/case/join?token=`.
 */
export function toFullInvitationLink(segment: string): string {
  return `mediacionapp://invitacion/${segment}`;
}
