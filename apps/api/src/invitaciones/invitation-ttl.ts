const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;

export function isInvitationExpired(
  fechaEnvio: string | null,
  now: Date = new Date(),
): boolean {
  if (!fechaEnvio) {
    return false;
  }
  return new Date(fechaEnvio).getTime() + invitationTtlMs < now.getTime();
}
