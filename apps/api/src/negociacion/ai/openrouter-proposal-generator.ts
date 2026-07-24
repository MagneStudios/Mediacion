import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import type {
  AiProposalGenerator,
  ProposalGenerationInput,
  ProposalGenerationOutput,
} from "./ai-proposal-generator";

const openrouterChatCompletionsUrl =
  "https://openrouter.ai/api/v1/chat/completions";
const openrouterRequestTimeoutMs = 30_000;

type OpenrouterChatCompletionsResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

@Injectable()
export class OpenrouterProposalGenerator implements AiProposalGenerator {
  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  async generateProposal(
    input: ProposalGenerationInput,
  ): Promise<ProposalGenerationOutput> {
    const response = await fetch(openrouterChatCompletionsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.appConfig.openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: [{ role: "user", content: input.prompt }],
      }),
      signal: AbortSignal.timeout(openrouterRequestTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `OpenRouter request failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as OpenrouterChatCompletionsResponse;
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("OpenRouter response did not include narrative content");
    }
    return { text };
  }
}
