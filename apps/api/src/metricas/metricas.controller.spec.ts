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
import { MetricasController } from "./metricas.controller";
import { MetricasRepository } from "./metricas.repository";
import { MetricasService } from "./metricas.service";

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

async function bootstrapApp(getMetricas: jest.Mock): Promise<INestApplication> {
  const usersRepository = {
    findAuthById: (id: string) =>
      Promise.resolve([adminUser, parteUser].find((user) => user.id === id)),
  };

  const moduleReference = await Test.createTestingModule({
    controllers: [MetricasController],
    providers: [
      MetricasService,
      { provide: MetricasRepository, useValue: { getMetricas } },
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

describe("GET /metricas", () => {
  let app: INestApplication;
  let getMetricas: jest.Mock;

  const metricas = {
    casosByEstado: { activo: 3 },
    usuariosByRol: { admin: 1 },
    acuerdosByEstado: { borrador: 2 },
  };

  beforeEach(async () => {
    getMetricas = jest.fn().mockResolvedValue(metricas);
    app = await bootstrapApp(getMetricas);
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request with 401 and never queries metricas", async () => {
    const response = await request(app.getHttpServer()).get("/metricas");

    expect(response.status).toBe(401);
    expect(getMetricas).not.toHaveBeenCalled();
  });

  it("rejects a non-admin with 403 and never queries metricas", async () => {
    const response = await request(app.getHttpServer())
      .get("/metricas")
      .set("Authorization", `Bearer ${parteUser.id}`);

    expect(response.status).toBe(403);
    expect(getMetricas).not.toHaveBeenCalled();
  });

  it("allows an admin to retrieve the aggregate metrics with no per-row data", async () => {
    const response = await request(app.getHttpServer())
      .get("/metricas")
      .set("Authorization", `Bearer ${adminUser.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(metricas);
    expect(Object.keys(response.body)).toEqual([
      "casosByEstado",
      "usuariosByRol",
      "acuerdosByEstado",
    ]);
  });
});
