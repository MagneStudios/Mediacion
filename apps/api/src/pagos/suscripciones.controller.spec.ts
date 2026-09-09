import type { INestApplication } from "@nestjs/common";
import { HttpException, HttpStatus } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { SuscripcionesController } from "./suscripciones.controller";
import { SuscripcionesService } from "./suscripciones.service";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};

describe("POST /suscripciones end-to-end", () => {
  async function bootstrapApp(
    createSuscripcion: jest.Mock,
    cancelSuscripcion: jest.Mock = jest.fn(),
    getVigente: jest.Mock = jest.fn(),
    getUso: jest.Mock = jest.fn(),
  ): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(id === parteA.id ? parteA : undefined),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [SuscripcionesController],
      providers: [
        {
          provide: SuscripcionesService,
          useValue: {
            createSuscripcion,
            cancelSuscripcion,
            getVigente,
            getUso,
          },
        },
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

  it("creates a subscription in pendiente_pago deriving the owner from the caller", async () => {
    const createSuscripcion = jest
      .fn()
      .mockResolvedValue({ id: "sus-1", estado: "pendiente_pago" });
    const app = await bootstrapApp(createSuscripcion);

    const response = await request(app.getHttpServer())
      .post("/suscripciones")
      .set("Authorization", "Bearer user-a")
      .send({ plan_id: "plan-1" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "sus-1", estado: "pendiente_pago" });
    expect(createSuscripcion).toHaveBeenCalledWith(parteA.id, {
      plan_id: "plan-1",
    });
    await app.close();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const createSuscripcion = jest.fn();
    const app = await bootstrapApp(createSuscripcion);

    const response = await request(app.getHttpServer())
      .post("/suscripciones")
      .send({ plan_id: "plan-1" });

    expect(response.status).toBe(401);
    expect(createSuscripcion).not.toHaveBeenCalled();
    await app.close();
  });

  it("cancels the caller's own subscription through POST /suscripciones/:id/baja", async () => {
    const cancelSuscripcion = jest.fn().mockResolvedValue({
      id: "sus-1",
      estado: "cancelada",
      fecha_fin: "2026-08-15T12:00:00.000Z",
    });
    const app = await bootstrapApp(jest.fn(), cancelSuscripcion);

    const response = await request(app.getHttpServer())
      .post("/suscripciones/sus-1/baja")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "sus-1",
      estado: "cancelada",
      fecha_fin: "2026-08-15T12:00:00.000Z",
    });
    expect(cancelSuscripcion).toHaveBeenCalledWith(parteA, "sus-1");
    await app.close();
  });

  it("reads the caller's current subscription through GET /suscripciones/vigente", async () => {
    const getVigente = jest.fn().mockResolvedValue({
      id: "sus-1",
      plan_id: "plan-1",
      estado: "activa",
      fecha_inicio: "2026-08-01T00:00:00.000Z",
      fecha_fin: null,
    });
    const app = await bootstrapApp(jest.fn(), jest.fn(), getVigente);

    const response = await request(app.getHttpServer())
      .get("/suscripciones/vigente")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "sus-1",
      plan_id: "plan-1",
      estado: "activa",
      fecha_inicio: "2026-08-01T00:00:00.000Z",
      fecha_fin: null,
    });
    expect(getVigente).toHaveBeenCalledWith(parteA.id);
    await app.close();
  });

  it("rejects an unauthenticated vigente read with 401", async () => {
    const getVigente = jest.fn();
    const app = await bootstrapApp(jest.fn(), jest.fn(), getVigente);

    const response = await request(app.getHttpServer()).get(
      "/suscripciones/vigente",
    );

    expect(response.status).toBe(401);
    expect(getVigente).not.toHaveBeenCalled();
    await app.close();
  });

  it("reads the caller's usage through GET /suscripciones/uso with the §3.1 shape", async () => {
    const uso = {
      period_start: "2026-08-14T00:00:00.000Z",
      period_end: "2026-09-13T00:00:00.000Z",
      negociaciones: { usado: 2, limite: 3 },
      clientes: null,
    };
    const getUso = jest.fn().mockResolvedValue(uso);
    const app = await bootstrapApp(jest.fn(), jest.fn(), jest.fn(), getUso);

    const response = await request(app.getHttpServer())
      .get("/suscripciones/uso")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(uso);
    expect(getUso).toHaveBeenCalledWith(parteA.id);
    await app.close();
  });

  it("answers 404 suscripcion_not_found on /uso with the plain envelope", async () => {
    const getUso = jest
      .fn()
      .mockRejectedValue(
        new HttpException(
          { code: "suscripcion_not_found", message: "Suscripcion not found" },
          HttpStatus.NOT_FOUND,
        ),
      );
    const app = await bootstrapApp(jest.fn(), jest.fn(), jest.fn(), getUso);

    const response = await request(app.getHttpServer())
      .get("/suscripciones/uso")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "suscripcion_not_found",
        message: "Suscripcion not found",
      },
    });
    await app.close();
  });

  it("rejects an unauthenticated uso read with 401", async () => {
    const getUso = jest.fn();
    const app = await bootstrapApp(jest.fn(), jest.fn(), jest.fn(), getUso);

    const response = await request(app.getHttpServer()).get(
      "/suscripciones/uso",
    );

    expect(response.status).toBe(401);
    expect(getUso).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects an unauthenticated baja with 401", async () => {
    const cancelSuscripcion = jest.fn();
    const app = await bootstrapApp(jest.fn(), cancelSuscripcion);

    const response = await request(app.getHttpServer()).post(
      "/suscripciones/sus-1/baja",
    );

    expect(response.status).toBe(401);
    expect(cancelSuscripcion).not.toHaveBeenCalled();
    await app.close();
  });
});
