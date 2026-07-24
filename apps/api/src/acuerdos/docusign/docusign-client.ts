export type DocusignSigner = {
  usuarioId: string;
  email: string;
  name: string;
};

export type CreateEnvelopeInput = {
  acuerdoId: string;
  signers: DocusignSigner[];
};

export type CreateEnvelopeOutput = {
  envelopeId: string;
};

export interface DocusignClient {
  createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeOutput>;
}

export const DOCUSIGN_CLIENT = Symbol("DOCUSIGN_CLIENT");
