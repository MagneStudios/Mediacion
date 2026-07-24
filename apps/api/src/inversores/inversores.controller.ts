import { Body, Controller, Inject, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { InversoresService } from "./inversores.service";
import type { CreateInversorDto, InversorResult } from "./types";

@Controller("inversores")
export class InversoresController {
  constructor(
    @Inject(InversoresService)
    private readonly inversoresService: InversoresService,
  ) {}

  @Post()
  @Public()
  createInversor(@Body() body: CreateInversorDto): Promise<InversorResult> {
    return this.inversoresService.createInversor(body);
  }
}
