import type { HealthStatus } from "@mediacion/shared";
import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";

@Controller("health")
export class HealthController {
  @Get()
  @Public()
  getHealth(): HealthStatus {
    return { status: "ok" };
  }
}
