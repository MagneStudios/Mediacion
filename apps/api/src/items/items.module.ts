import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { ItemsController } from "./items.controller";
import { ItemsRepository } from "./items.repository";
import { ItemsService } from "./items.service";
import { ModeracionModule } from "../moderacion/moderacion.module";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule, ModeracionModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository],
})
export class ItemsModule {}
