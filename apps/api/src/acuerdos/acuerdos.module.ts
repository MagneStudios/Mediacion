import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { TareasModule } from "../tareas/tareas.module";
import { AcuerdoAccessService } from "./acuerdo-access.service";
import { AcuerdosController } from "./acuerdos.controller";
import { AcuerdosRepository } from "./acuerdos.repository";
import { AcuerdosService } from "./acuerdos.service";
import { DOCUSIGN_CLIENT } from "./docusign/docusign-client";
import { DocusignOauthTokenClient } from "./docusign/docusign-oauth-token-client";
import { HttpDocusignClient } from "./docusign/http-docusign-client";
import { FirmasRepository } from "./firmas.repository";
import { DocusignWebhookController } from "./webhook/docusign-webhook.controller";
import { DocusignWebhookService } from "./webhook/docusign-webhook.service";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule, TareasModule],
  controllers: [AcuerdosController, DocusignWebhookController],
  providers: [
    AcuerdosService,
    AcuerdoAccessService,
    AcuerdosRepository,
    FirmasRepository,
    DocusignWebhookService,
    DocusignOauthTokenClient,
    { provide: DOCUSIGN_CLIENT, useClass: HttpDocusignClient },
  ],
})
export class AcuerdosModule {}
