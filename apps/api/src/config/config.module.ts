import { Global, Module } from "@nestjs/common";
import { loadConfig } from "./config";
import { APP_CONFIG } from "./config.tokens";

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
