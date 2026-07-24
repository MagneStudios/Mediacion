import { Body, Controller, Inject, Patch } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { ConfiguracionService } from "./configuracion.service";
import type { IaConfigResult, UpdateIaConfigDto } from "./types";

@Controller("config")
export class ConfiguracionController {
  constructor(
    @Inject(ConfiguracionService)
    private readonly configuracionService: ConfiguracionService,
  ) {}

  @Patch("ia")
  @Roles("admin")
  updateIaConfig(@Body() body: UpdateIaConfigDto): Promise<IaConfigResult> {
    return this.configuracionService.updateIaConfig(body);
  }
}
