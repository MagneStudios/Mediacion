import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { RolesGuard } from "../auth/roles.guard";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { MembershipService } from "../casos/membership.service";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { MediacionController } from "./mediacion.controller";
import { MediacionService } from "./mediacion.service";

const parteA: AuthenticatedUser = {
  id: "ba513e5d-1619-4430-8d09-0b44b34598d5",
  email: "a@b.com",
  rol: "parte",
};
const admin: AuthenticatedUser = {
  id: "f6a3266e-ad53-4628-8b1b-126064854c85",
  email: "admin@b.com",
  rol: "admin",
};
const mediador: AuthenticatedUser = {
  id: "483ff6af-32f5-45c7-8387-2fc7287768e9",
  email: "med@b.com",
  rol: "mediador",
};

describe("/casos/:casoId/mediacion and PATCH /mediacion/:id end-to-end", () => {
  async function bootstrapApp(
    requestMediacion: jest.Mock,
    updateEstado: jest.Mock,
  ): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(
          [parteA, admin, mediador].find((user) => user.id === id),
        ),
    };
    const membershipService = { assertMembership: jest.fn() };

    const moduleReference = await Test.createTestingModule({
      controllers: [MediacionController],
      providers: [
        {
          provide: MediacionService,
          useValue: { requestMediacion, updateEstado },
        },
        { provide: MembershipService, useValue: membershipService },
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

  it("rejects an unauthenticated POST with 401", async () => {
    const requestMediacion = jest.fn();
    const app = await bootstrapApp(requestMediacion, jest.fn());

    const response = await request(app.getHttpServer())
      .post("/casos/fc8f1934-c72c-49d4-88a5-202797b30da7/mediacion")
      .send({ mediadorId: mediador.id });

    expect(response.status).toBe(401);
    expect(requestMediacion).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets an authenticated party POST a mediacion request and returns 201", async () => {
    const view = {
      id: "ff5c34d8-404f-4a62-81bf-0c1449b37225",
      caso_id: "fc8f1934-c72c-49d4-88a5-202797b30da7",
      mediador_id: mediador.id,
      estado: "solicitada",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: null,
    };
    const requestMediacion = jest.fn().mockResolvedValue(view);
    const app = await bootstrapApp(requestMediacion, jest.fn());

    const response = await request(app.getHttpServer())
      .post("/casos/fc8f1934-c72c-49d4-88a5-202797b30da7/mediacion")
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ mediadorId: mediador.id });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(view);
    expect(requestMediacion).toHaveBeenCalledWith(
      "fc8f1934-c72c-49d4-88a5-202797b30da7",
      parteA.id,
      mediador.id,
    );
    await app.close();
  });

  it("rejects an unauthenticated PATCH with 401", async () => {
    const updateEstado = jest.fn();
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/ff5c34d8-404f-4a62-81bf-0c1449b37225")
      .send({ estado: "aceptada" });

    expect(response.status).toBe(401);
    expect(updateEstado).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a PATCH from a plain parte caller with 403 at the role guard", async () => {
    const updateEstado = jest.fn();
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/ff5c34d8-404f-4a62-81bf-0c1449b37225")
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ estado: "aceptada" });

    expect(response.status).toBe(403);
    expect(updateEstado).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets the assigned mediador PATCH to aceptada and returns 200", async () => {
    const view = {
      id: "ff5c34d8-404f-4a62-81bf-0c1449b37225",
      caso_id: "fc8f1934-c72c-49d4-88a5-202797b30da7",
      mediador_id: mediador.id,
      estado: "aceptada",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: "now",
    };
    const updateEstado = jest.fn().mockResolvedValue(view);
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/ff5c34d8-404f-4a62-81bf-0c1449b37225")
      .set("Authorization", `Bearer ${mediador.id}`)
      .send({ estado: "aceptada" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(view);
    expect(updateEstado).toHaveBeenCalledWith(
      "ff5c34d8-404f-4a62-81bf-0c1449b37225",
      mediador,
      "aceptada",
    );
    await app.close();
  });

  it("returns 404 when the service reports the mediacion is not accessible to this caller", async () => {
    const notFound = new HttpException(
      { code: "mediacion_not_found", message: "Mediacion not found" },
      404,
    );
    const updateEstado = jest.fn().mockRejectedValue(notFound);
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/ff5c34d8-404f-4a62-81bf-0c1449b37225")
      .set("Authorization", `Bearer ${mediador.id}`)
      .send({ estado: "aceptada" });

    expect(response.status).toBe(404);
    await app.close();
  });

  it("lets an admin PATCH to activa and returns 200", async () => {
    const view = {
      id: "ff5c34d8-404f-4a62-81bf-0c1449b37225",
      caso_id: "fc8f1934-c72c-49d4-88a5-202797b30da7",
      mediador_id: mediador.id,
      estado: "activa",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: "now",
    };
    const updateEstado = jest.fn().mockResolvedValue(view);
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/ff5c34d8-404f-4a62-81bf-0c1449b37225")
      .set("Authorization", `Bearer ${admin.id}`)
      .send({ estado: "activa" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(view);
    await app.close();
  });
});
