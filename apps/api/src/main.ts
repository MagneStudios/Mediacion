import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/config";

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const appConfig = loadConfig(process.env);
  await app.listen(appConfig.port);
}

type BootstrapFailureHandlers = {
  logError: (error: unknown) => void;
  exitProcess: (code: number) => void;
};

export function handleBootstrapFailure(
  error: unknown,
  handlers: BootstrapFailureHandlers,
): void {
  handlers.logError(error);
  handlers.exitProcess(1);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) =>
    handleBootstrapFailure(error, {
      logError: console.error,
      exitProcess: process.exit,
    }),
  );
}
