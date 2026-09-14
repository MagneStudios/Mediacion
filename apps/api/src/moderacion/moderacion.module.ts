import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ModeracionRepository } from "./moderacion.repository";
import { ModeracionService } from "./moderacion.service";

@Module({
  imports: [DatabaseModule],
  providers: [ModeracionRepository, ModeracionService],
  exports: [ModeracionService],
})
export class ModeracionModule {}
