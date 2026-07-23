import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { ConfiguracionRepository } from "./configuracion.repository";
import { PropuestasRepository } from "./propuestas.repository";
import { RespuestasRepository } from "./respuestas.repository";
import { RondasRepository } from "./rondas.repository";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  providers: [
    PropuestasRepository,
    RondasRepository,
    RespuestasRepository,
    ConfiguracionRepository,
  ],
  exports: [
    PropuestasRepository,
    RondasRepository,
    RespuestasRepository,
    ConfiguracionRepository,
  ],
})
export class NegociacionModule {}
