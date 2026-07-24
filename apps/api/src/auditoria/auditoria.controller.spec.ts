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
import { AuditoriaController } from "./auditoria.controller";
import { AuditoriaRepository } from "./auditoria.repository";
import { AuditoriaService } from "./auditoria.service";

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
  findPage: jest.Mock,
  count: jest.Mock,
): Promise<INestApplication> {
  const usersRepository = {
    findAuthById: (id: string) =>
      Promise.resolve([adminUser, parteUser].find((user) => user.id === id)),
  };

  const moduleReference = await Test.createTestingModule({
    controllers: [AuditoriaController],
    providers: [
      AuditoriaService,
      { provide: AuditoriaRepository, useValue: { findPage, count } },
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

describe("GET /auditoria", () => {
  let app: INestApplication;
  let findPage: jest.Mock;
  let count: jest.Mock;

  const items = [{ id: "1", accion: "update", entidad: "casos" }];

  beforeEach(async () => {
    findPage = jest.fn().mockResolvedValue(items);
    count = jest.fn().mockResolvedValue(1);
    app = await bootstrapApp(findPage, count);
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request with 401 and never reads auditoria", async () => {
    const response = await request(app.getHttpServer()).get("/auditoria");

    expect(response.status).toBe(401);
    expect(findPage).not.toHaveBeenCalled();
  });

  it("rejects a non-admin with 403 and never reads auditoria", async () => {
    const response = await request(app.getHttpServer())
      .get("/auditoria")
      .set("Authorization", `Bearer ${parteUser.id}`);

    expect(response.status).toBe(403);
    expect(findPage).not.toHaveBeenCalled();
  });

  it("allows an admin to retrieve a paginated page with defaults applied", async () => {
    const response = await request(app.getHttpServer())
      .get("/auditoria")
      .set("Authorization", `Bearer ${adminUser.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items,
      page: 1,
      limit: 20,
      total: 1,
    });
    expect(findPage).toHaveBeenCalledWith(0, 20);
  });

  it("allows an admin to request an explicit page and limit", async () => {
    const response = await request(app.getHttpServer())
      .get("/auditoria?page=2&limit=5")
      .set("Authorization", `Bearer ${adminUser.id}`);

    expect(response.status).toBe(200);
    expect(findPage).toHaveBeenCalledWith(5, 5);
  });

  it("rejects an admin request with an invalid page with 400", async () => {
    const response = await request(app.getHttpServer())
      .get("/auditoria?page=abc")
      .set("Authorization", `Bearer ${adminUser.id}`);

    expect(response.status).toBe(400);
    expect(findPage).not.toHaveBeenCalled();
  });

  it("caps an oversized limit at 100 for an admin request", async () => {
    const response = await request(app.getHttpServer())
      .get("/auditoria?limit=1000")
      .set("Authorization", `Bearer ${adminUser.id}`);

    expect(response.status).toBe(200);
    expect(findPage).toHaveBeenCalledWith(0, 100);
  });
});
