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
import { FirmasRepository } from "./firmas.repository";
import { HttpSignnowClient } from "./signnow/http-signnow-client";
import { SignnowTokenClient } from "./signnow/signnow-token-client";
import { DocusignWebhookController } from "./webhook/docusign-webhook.controller";
import { DocusignWebhookService } from "./webhook/docusign-webhook.service";
import { SignnowWebhookController } from "./webhook/signnow-webhook.controller";
import { SignnowWebhookService } from "./webhook/signnow-webhook.service";

@Module({
  imports: [AuthModule, DatabaseModule, CasosModule, TareasModule],
  controllers: [
    AcuerdosController,
    DocusignWebhookController,
    SignnowWebhookController,
  ],
  providers: [
    AcuerdosService,
    AcuerdoAccessService,
    AcuerdosRepository,
    FirmasRepository,
    DocusignWebhookService,
    SignnowWebhookService,
    SignnowTokenClient,
    HttpSignnowClient,
    { provide: DOCUSIGN_CLIENT, useExisting: HttpSignnowClient },
  ],
  exports: [AcuerdosRepository, AcuerdoAccessService, FirmasRepository],
})
export class AcuerdosModule {}
