import { randomUUID } from "node:crypto";
import type {
  CreateEnvelopeInput,
  CreateEnvelopeOutput,
  DocusignClient,
} from "./docusign-client";

export class FakeDocusignClient implements DocusignClient {
  readonly createEnvelopeCalls: CreateEnvelopeInput[] = [];

  async createEnvelope(
    input: CreateEnvelopeInput,
  ): Promise<CreateEnvelopeOutput> {
    this.createEnvelopeCalls.push(input);
    return { envelopeId: randomUUID() };
  }
}
