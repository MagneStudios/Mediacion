export const LAWYER_PAYMENT_HANDLER = Symbol("LAWYER_PAYMENT_HANDLER");

export type LawyerPaymentSettlement = {
  externalReference: string;
  mpPaymentId: string;
  approved: boolean;
};

/**
 * The seam the Mercado Pago webhook uses to settle a lawyer payment.
 *
 * It exists so the payments module can route an external reference it does not
 * own without importing this domain's service — the same shape as
 * DOCUSIGN_CLIENT and AI_PROPOSAL_GENERATOR.
 */
export interface LawyerPaymentHandler {
  settlePayment(input: LawyerPaymentSettlement): Promise<void>;
}
