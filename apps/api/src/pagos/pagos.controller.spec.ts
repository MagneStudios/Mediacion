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
import { PagosController } from "./pagos.controller";
import { PagosService } from "./pagos.service";

const parteA: AuthenticatedUser = {
  id: "ba513e5d-1619-4430-8d09-0b44b34598d5",
  email: "a@b.com",
  rol: "parte",
};

describe("POST /suscripciones/:id/pago end-to-end", () => {
  async function bootstrapApp(
    createPreference: jest.Mock,
  ): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(id === parteA.id ? parteA : undefined),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [PagosController],
      providers: [
        { provide: PagosService, useValue: { createPreference } },
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

  it("creates a preference and returns init_point for the owning caller", async () => {
    const createPreference = jest
      .fn()
      .mockResolvedValue({ init_point: "https://mp.example.com/pref-1" });
    const app = await bootstrapApp(createPreference);

    const response = await request(app.getHttpServer())
      .post("/suscripciones/4053e52d-c4b3-4bb3-8bf6-ca41c9caa8f1/pago")
      .set("Authorization", "Bearer ba513e5d-1619-4430-8d09-0b44b34598d5")
      .send();

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      init_point: "https://mp.example.com/pref-1",
    });
    expect(createPreference).toHaveBeenCalledWith(
      "4053e52d-c4b3-4bb3-8bf6-ca41c9caa8f1",
      parteA.id,
    );
    await app.close();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const createPreference = jest.fn();
    const app = await bootstrapApp(createPreference);

    const response = await request(app.getHttpServer())
      .post("/suscripciones/4053e52d-c4b3-4bb3-8bf6-ca41c9caa8f1/pago")
      .send();

    expect(response.status).toBe(401);
    expect(createPreference).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a non-owning caller with 404, without calling Mercado Pago", async () => {
    const createPreference = jest
      .fn()
      .mockRejectedValue(
        new HttpException(
          { code: "suscripcion_not_found", message: "Suscripcion not found" },
          HttpStatus.NOT_FOUND,
        ),
      );
    const app = await bootstrapApp(createPreference);

    const response = await request(app.getHttpServer())
      .post("/suscripciones/4053e52d-c4b3-4bb3-8bf6-ca41c9caa8f1/pago")
      .set("Authorization", "Bearer ba513e5d-1619-4430-8d09-0b44b34598d5")
      .send();

    expect(response.status).toBe(404);
    expect(createPreference).toHaveBeenCalledWith(
      "4053e52d-c4b3-4bb3-8bf6-ca41c9caa8f1",
      parteA.id,
    );
    await app.close();
  });
});
