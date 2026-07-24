import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AcuerdosModule } from "./acuerdos/acuerdos.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { RolesGuard } from "./auth/roles.guard";
import { CasosModule } from "./casos/casos.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ConfigModule } from "./config/config.module";
import { ConfiguracionModule } from "./configuracion/configuracion.module";
import { DatabaseModule } from "./database/database.module";
import { EstudiosModule } from "./estudios/estudios.module";
import { HealthModule } from "./health/health.module";
import { InversoresModule } from "./inversores/inversores.module";
import { InvitacionesModule } from "./invitaciones/invitaciones.module";
import { ItemsModule } from "./items/items.module";
import { MeModule } from "./me/me.module";
import { NegociacionModule } from "./negociacion/negociacion.module";
import { PagosModule } from "./pagos/pagos.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    MeModule,
    CasosModule,
    InvitacionesModule,
    ItemsModule,
    AcuerdosModule,
    ConfiguracionModule,
    EstudiosModule,
    InversoresModule,
    NegociacionModule,
    PagosModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
})
export class AppModule {}
