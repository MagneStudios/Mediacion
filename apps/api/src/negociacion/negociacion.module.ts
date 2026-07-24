import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { AI_PROPOSAL_GENERATOR } from "./ai/ai-proposal-generator";
import { OpenrouterProposalGenerator } from "./ai/openrouter-proposal-generator";
import { ConfiguracionRepository } from "./configuracion.repository";
import { NegociacionController } from "./negociacion.controller";
import { NegociacionService } from "./negociacion.service";
import { PropuestasRepository } from "./propuestas.repository";
import { RespuestasRepository } from "./respuestas.repository";
import { RondasRepository } from "./rondas.repository";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule],
  controllers: [NegociacionController],
  providers: [
    PropuestasRepository,
    RondasRepository,
    RespuestasRepository,
    ConfiguracionRepository,
    NegociacionService,
    { provide: AI_PROPOSAL_GENERATOR, useClass: OpenrouterProposalGenerator },
  ],
  exports: [
    PropuestasRepository,
    RondasRepository,
    RespuestasRepository,
    ConfiguracionRepository,
    NegociacionService,
  ],
})
export class NegociacionModule {}
