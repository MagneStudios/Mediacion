import type { INestApplication } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { RolesGuard } from "../auth/roles.guard";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { ConfiguracionController } from "./configuracion.controller";
import { ConfiguracionRepository } from "./configuracion.repository";
import { ConfiguracionService } from "./configuracion.service";

const adminUser: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@b.com",
  rol: "admin",
};
const parteUser: AuthenticatedUser = {
  id: "parte-1",
  email: "parte@b.com",
  rol: "parte",
};

async function bootstrapApp(
  upsertIaKeys: jest.Mock,
): Promise<INestApplication> {
  const usersRepository = {
    findAuthById: (id: string) =>
      Promise.resolve([adminUser, parteUser].find((user) => user.id === id)),
  };

  const moduleReference = await Test.createTestingModule({
    controllers: [ConfiguracionController],
    providers: [
      ConfiguracionService,
      { provide: ConfiguracionRepository, useValue: { upsertIaKeys } },
      { provide: UsersRepository, useValue: usersRepository },
      {
        provide: TOKEN_VERIFIER,
        useValue: {
          verify: (token: string) => Promise.resolve({ sub: token }),
        },
      },
      AuthGuard,
      RolesGuard,
      { provide: APP_GUARD, useExisting: AuthGuard },
      { provide: APP_GUARD, useExisting: RolesGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();

  const app = moduleReference.createNestApplication();
  await app.init();
  return app;
}

describe("PATCH /config/ia", () => {
  let app: INestApplication;
  let upsertIaKeys: jest.Mock;

  beforeEach(async () => {
    upsertIaKeys = jest.fn().mockResolvedValue(["ia_modelo"]);
    app = await bootstrapApp(upsertIaKeys);
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request with 401 and never touches configuracion", async () => {
    const response = await request(app.getHttpServer())
      .patch("/config/ia")
      .send({ ia_modelo: "openai/gpt-4" });

    expect(response.status).toBe(401);
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });

  it("rejects a non-admin with 403 and never touches configuracion", async () => {
    const response = await request(app.getHttpServer())
      .patch("/config/ia")
      .set("Authorization", `Bearer ${parteUser.id}`)
      .send({ ia_modelo: "openai/gpt-4" });

    expect(response.status).toBe(403);
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });

  it("allows an admin to update allowlisted keys", async () => {
    const response = await request(app.getHttpServer())
      .patch("/config/ia")
      .set("Authorization", `Bearer ${adminUser.id}`)
      .send({ ia_modelo: "openai/gpt-4" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: ["ia_modelo"] });
    expect(upsertIaKeys).toHaveBeenCalledWith({ ia_modelo: "openai/gpt-4" });
  });

  it("rejects an admin request containing docusign_webhook_secret with 400 and never touches configuracion", async () => {
    const response = await request(app.getHttpServer())
      .patch("/config/ia")
      .set("Authorization", `Bearer ${adminUser.id}`)
      .send({ docusign_webhook_secret: "leaked" });

    expect(response.status).toBe(400);
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });

  it("rejects an admin request containing mp_webhook_secret with 400 and never touches configuracion", async () => {
    const response = await request(app.getHttpServer())
      .patch("/config/ia")
      .set("Authorization", `Bearer ${adminUser.id}`)
      .send({ mp_webhook_secret: "leaked" });

    expect(response.status).toBe(400);
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });
});
