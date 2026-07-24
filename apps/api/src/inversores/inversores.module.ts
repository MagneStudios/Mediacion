import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { InversoresController } from "./inversores.controller";
import { InversoresRepository } from "./inversores.repository";
import { InversoresService } from "./inversores.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [InversoresController],
  providers: [InversoresService, InversoresRepository],
})
export class InversoresModule {}
