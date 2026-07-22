import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const appConfig = loadConfig(process.env);
  await app.listen(appConfig.port);
}

bootstrap();
