import {
  docusignStatusDeclined,
  docusignStatusDelivered,
  docusignStatusPending,
  docusignStatusSent,
  docusignStatusSigned,
  docusignStatusVoided,
} from "../acuerdos.types";

const nonTerminalPrecedence: Record<string, number> = {
  [docusignStatusPending]: 0,
  [docusignStatusSent]: 1,
  [docusignStatusDelivered]: 2,
  [docusignStatusSigned]: 3,
};

const terminalStatuses = new Set<string>([
  docusignStatusDeclined,
  docusignStatusVoided,
]);

export function isRegressiveStatusTransition(
  storedStatus: string,
  incomingStatus: string,
): boolean {
  if (terminalStatuses.has(storedStatus)) {
    return true;
  }
  if (terminalStatuses.has(incomingStatus)) {
    return false;
  }
  const storedRank = nonTerminalPrecedence[storedStatus] ?? -1;
  const incomingRank = nonTerminalPrecedence[incomingStatus] ?? -1;
  return incomingRank < storedRank;
}
