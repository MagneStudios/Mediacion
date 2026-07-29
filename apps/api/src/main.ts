import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/config";

const wildcardOrigin = "*";

type CorsCapableApp = { enableCors: (options: unknown) => unknown };

/**
 * Native clients ignore CORS, but Expo Web does not. Origins stay opt-in through
 * CORS_ORIGINS so that an unconfigured deployment does not silently become open.
 */
export function applyCors(app: CorsCapableApp, origins: string[]): void {
  if (origins.length === 0) {
    return;
  }
  app.enableCors({
    origin: origins.includes(wildcardOrigin) ? wildcardOrigin : origins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
  });
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const appConfig = loadConfig(process.env);
  applyCors(app, appConfig.corsOrigins);
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
