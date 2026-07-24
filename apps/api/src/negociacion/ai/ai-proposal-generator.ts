export type ProposalGenerationInput = {
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

export type ProposalGenerationOutput = {
  text: string;
};

export interface AiProposalGenerator {
  generateProposal(
    input: ProposalGenerationInput,
  ): Promise<ProposalGenerationOutput>;
}

export const AI_PROPOSAL_GENERATOR = Symbol("AI_PROPOSAL_GENERATOR");
