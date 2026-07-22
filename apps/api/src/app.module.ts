import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
