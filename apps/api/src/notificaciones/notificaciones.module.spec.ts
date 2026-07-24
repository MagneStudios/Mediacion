import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { NotificacionesModule } from "./notificaciones.module";
import { NotificacionesService } from "./notificaciones.service";

describe("NotificacionesModule", () => {
  let moduleReference: TestingModule;

  beforeAll(async () => {
    moduleReference = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, NotificacionesModule],
    }).compile();
  });

  afterAll(async () => {
    await moduleReference.close();
  });

  it("boots with no-op provider defaults and resolves an emit-capable service", () => {
    const service = moduleReference.get(NotificacionesService);

    expect(service).toBeInstanceOf(NotificacionesService);
  });
});
