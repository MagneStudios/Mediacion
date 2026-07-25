import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

export type ExpressRequestListener = (
  request: unknown,
  response: unknown,
) => void;

let appPromise: Promise<ExpressRequestListener> | undefined;

async function bootstrapServerlessApp(): Promise<ExpressRequestListener> {
  const app: INestApplication = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix("api");
  await app.init();
  return app.getHttpAdapter().getInstance() as ExpressRequestListener;
}

export function getServerlessApp(): Promise<ExpressRequestListener> {
  if (!appPromise) {
    appPromise = bootstrapServerlessApp().catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  }
  return appPromise;
}
