import type { HealthStatus } from "@mediacion/shared";
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthStatus {
    return { status: "ok" };
  }
}
