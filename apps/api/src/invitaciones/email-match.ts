export function emailsMatch(
  emailDestino: string | null,
  callerEmail: string,
): boolean {
  if (!emailDestino) {
    return false;
  }
  return emailDestino.toLowerCase() === callerEmail.toLowerCase();
}
