import { Inject, Injectable } from "@nestjs/common";
import { ConfiguracionRepository } from "./configuracion.repository";
import { assertValidIaConfigPatch } from "./ia-allowlist";
import type { IaConfigResult, UpdateIaConfigDto } from "./types";

@Injectable()
export class ConfiguracionService {
  constructor(
    @Inject(ConfiguracionRepository)
    private readonly configuracionRepository: ConfiguracionRepository,
  ) {}

  async updateIaConfig(patch: UpdateIaConfigDto): Promise<IaConfigResult> {
    assertValidIaConfigPatch(patch);
    const updated = await this.configuracionRepository.upsertIaKeys(patch);
    return { updated };
  }
}
