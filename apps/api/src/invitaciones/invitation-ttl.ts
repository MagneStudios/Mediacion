export const DEFAULT_INVITATION_TTL_HOURS = 72;

export function isInvitationExpired(
  fechaEnvio: string | null,
  now: Date = new Date(),
  ttlHours: number = DEFAULT_INVITATION_TTL_HOURS,
): boolean {
  if (!fechaEnvio) {
    return false;
  }
  const ttlMs = ttlHours * 60 * 60 * 1000;
  return new Date(fechaEnvio).getTime() + ttlMs < now.getTime();
}