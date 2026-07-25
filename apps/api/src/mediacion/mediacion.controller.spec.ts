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
import type { MediacionView } from "./mediacion.types";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};
const admin: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@b.com",
  rol: "admin",
};
const mediador: AuthenticatedUser = {
  id: "mediador-1",
  email: "med@b.com",
  rol: "mediador",
};

describe("MediacionController unit", () => {
  it("requestMediacion passes casoId, caller id and mediadorId through to the service", async () => {
    const view: MediacionView = {
      id: "mediacion-1",
      caso_id: "caso-1",
      mediador_id: mediador.id,
      estado: "solicitada",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: null,
    };
    const requestMediacion = jest.fn().mockResolvedValue(view);
    const controller = new MediacionController({
      requestMediacion,
    } as unknown as MediacionService);

    const result = await controller.requestMediacion("caso-1", parteA, {
      mediadorId: mediador.id,
    });

    expect(requestMediacion).toHaveBeenCalledWith(
      "caso-1",
      parteA.id,
      mediador.id,
    );
    expect(result).toBe(view);
  });

  it("updateEstado passes mediacion id, caller and estado through to the service", async () => {
    const view: MediacionView = {
      id: "mediacion-1",
      caso_id: "caso-1",
      mediador_id: mediador.id,
      estado: "aceptada",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: "now",
    };
    const updateEstado = jest.fn().mockResolvedValue(view);
    const controller = new MediacionController({
      updateEstado,
    } as unknown as MediacionService);

    const result = await controller.updateEstado("mediacion-1", mediador, {
      estado: "aceptada",
    });

    expect(updateEstado).toHaveBeenCalledWith(
      "mediacion-1",
      mediador,
      "aceptada",
    );
    expect(result).toBe(view);
  });

  it("propagates a 404 thrown by the service unchanged", async () => {
    const notFound = new HttpException(
      { code: "mediacion_not_found", message: "Mediacion not found" },
      404,
    );
    const updateEstado = jest.fn().mockRejectedValue(notFound);
    const controller = new MediacionController({
      updateEstado,
    } as unknown as MediacionService);

    await expect(
      controller.updateEstado("mediacion-1", parteA, { estado: "aceptada" }),
    ).rejects.toBe(notFound);
  });
});

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
      .post("/casos/caso-1/mediacion")
      .send({ mediadorId: mediador.id });

    expect(response.status).toBe(401);
    expect(requestMediacion).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets an authenticated party POST a mediacion request and returns 201", async () => {
    const view = {
      id: "mediacion-1",
      caso_id: "caso-1",
      mediador_id: mediador.id,
      estado: "solicitada",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: null,
    };
    const requestMediacion = jest.fn().mockResolvedValue(view);
    const app = await bootstrapApp(requestMediacion, jest.fn());

    const response = await request(app.getHttpServer())
      .post("/casos/caso-1/mediacion")
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ mediadorId: mediador.id });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(view);
    expect(requestMediacion).toHaveBeenCalledWith(
      "caso-1",
      parteA.id,
      mediador.id,
    );
    await app.close();
  });

  it("rejects an unauthenticated PATCH with 401", async () => {
    const updateEstado = jest.fn();
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/mediacion-1")
      .send({ estado: "aceptada" });

    expect(response.status).toBe(401);
    expect(updateEstado).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a PATCH from a plain parte caller with 403 at the role guard", async () => {
    const updateEstado = jest.fn();
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/mediacion-1")
      .set("Authorization", `Bearer ${parteA.id}`)
      .send({ estado: "aceptada" });

    expect(response.status).toBe(403);
    expect(updateEstado).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets the assigned mediador PATCH to aceptada and returns 200", async () => {
    const view = {
      id: "mediacion-1",
      caso_id: "caso-1",
      mediador_id: mediador.id,
      estado: "aceptada",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: "now",
    };
    const updateEstado = jest.fn().mockResolvedValue(view);
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/mediacion-1")
      .set("Authorization", `Bearer ${mediador.id}`)
      .send({ estado: "aceptada" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(view);
    expect(updateEstado).toHaveBeenCalledWith(
      "mediacion-1",
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
      .patch("/mediacion/mediacion-1")
      .set("Authorization", `Bearer ${mediador.id}`)
      .send({ estado: "aceptada" });

    expect(response.status).toBe(404);
    await app.close();
  });

  it("lets an admin PATCH to activa and returns 200", async () => {
    const view = {
      id: "mediacion-1",
      caso_id: "caso-1",
      mediador_id: mediador.id,
      estado: "activa",
      ronda: 3,
      fecha_solicitud: "now",
      fecha_aceptacion: "now",
    };
    const updateEstado = jest.fn().mockResolvedValue(view);
    const app = await bootstrapApp(jest.fn(), updateEstado);

    const response = await request(app.getHttpServer())
      .patch("/mediacion/mediacion-1")
      .set("Authorization", `Bearer ${admin.id}`)
      .send({ estado: "activa" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(view);
    await app.close();
  });
});
