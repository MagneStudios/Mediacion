import type { INestApplication } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { PlanesController } from "./planes.controller";
import { PlanesService } from "./planes.service";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};

describe("GET /planes authenticated end-to-end", () => {
  const plans = [
    {
      id: "plan-plus",
      nombre: "plus",
      limite_carpetas: -1,
      limite_casos: -1,
      limite_iteraciones_ia: -1,
      precio: 19.99,
      moneda: "ARS",
    },
  ];

  async function bootstrapApp(): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(id === parteA.id ? parteA : undefined),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [PlanesController],
      providers: [
        { provide: PlanesService, useValue: { listPlanes: () => plans } },
        { provide: UsersRepository, useValue: usersRepository },
        {
          provide: TOKEN_VERIFIER,
          useValue: {
            verify: (token: string) => Promise.resolve({ sub: token }),
          },
        },
        AuthGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();

    const app = moduleReference.createNestApplication();
    await app.init();
    return app;
  }

  it("returns limits and precio, keeping -1 unlimited unchanged", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer())
      .get("/planes")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(plans);
    await app.close();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer()).get("/planes");

    expect(response.status).toBe(401);
    await app.close();
  });
});
