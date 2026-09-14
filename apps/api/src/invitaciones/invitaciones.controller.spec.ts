import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { MembershipService } from "../casos/membership.service";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { NotificacionesService } from "../notificaciones/notificaciones.service";
import { InvitacionesController } from "./invitaciones.controller";
import { InvitacionesRepository } from "./invitaciones.repository";
import { InvitacionesService } from "./invitaciones.service";

const parteA: AuthenticatedUser = {
  id: "ba513e5d-1619-4430-8d09-0b44b34598d5",
  email: "a@b.com",
  rol: "parte",
};
const parteB: AuthenticatedUser = {
  id: "2549140f-3853-4bd8-8593-0f68ab627390",
  email: "b@b.com",
  rol: "parte",
};

describe("POST /casos/unirse and /casos/:id/invitaciones end-to-end", () => {
  async function bootstrapApp(overrides: {
    assertMembership: jest.Mock;
    createInvite?: jest.Mock;
    joinCase?: jest.Mock;
    refreshInvite?: jest.Mock;
  }): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve([parteA, parteB].find((user) => user.id === id)),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [InvitacionesController],
      providers: [
        InvitacionesService,
        {
          provide: InvitacionesRepository,
          useValue: {
            createInvite: overrides.createInvite ?? jest.fn(),
            joinCase: overrides.joinCase ?? jest.fn(),
            findUsuarioIdByEmail: jest.fn(),
            refreshInvite: overrides.refreshInvite ?? jest.fn(),
          },
        },
        {
          provide: MembershipService,
          useValue: { assertMembership: overrides.assertMembership },
        },
        {
          provide: NotificacionesService,
          useValue: { emit: jest.fn() },
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

  it("rejects an unauthenticated join attempt with 401", async () => {
    const app = await bootstrapApp({ assertMembership: jest.fn() });

    const response = await request(app.getHttpServer())
      .post("/casos/unirse")
      .send({ token: "2acea42e-bb57-44d6-8ad3-aad955ec50af" });

    expect(response.status).toBe(401);
    await app.close();
  });

  it("creates an invitation for the case creator", async () => {
    const assertMembership = jest.fn().mockResolvedValue({
      rol_en_caso: "parte_a",
    });
    const createInvite = jest.fn().mockResolvedValue({
      id: "a1dc238a-c774-4d3d-841b-f32dce1112ce",
      tipo: "link",
      token: "2acea42e-bb57-44d6-8ad3-aad955ec50af",
      estado: "pendiente",
    });
    const app = await bootstrapApp({ assertMembership, createInvite });

    const response = await request(app.getHttpServer())
      .post("/casos/fc8f1934-c72c-49d4-88a5-202797b30da7/invitaciones")
      .set("Authorization", "Bearer ba513e5d-1619-4430-8d09-0b44b34598d5")
      .send({ tipo: "link" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "a1dc238a-c774-4d3d-841b-f32dce1112ce",
      tipo: "link",
      token: "2acea42e-bb57-44d6-8ad3-aad955ec50af",
      estado: "pendiente",
    });
    await app.close();
  });

  it("rejects a non-creator member's invitation attempt with 403", async () => {
    const assertMembership = jest.fn().mockResolvedValue({
      rol_en_caso: "parte_b",
    });
    const app = await bootstrapApp({ assertMembership });

    const response = await request(app.getHttpServer())
      .post("/casos/fc8f1934-c72c-49d4-88a5-202797b30da7/invitaciones")
      .set("Authorization", "Bearer 2549140f-3853-4bd8-8593-0f68ab627390")
      .send({ tipo: "link" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: { code: "forbidden", message: "Only the case creator can invite" },
    });
    await app.close();
  });

  it("rejects a non-member's invitation attempt with 404", async () => {
    const assertMembership = jest
      .fn()
      .mockRejectedValue(
        new HttpException(
          { code: "caso_not_found", message: "Case not found" },
          404,
        ),
      );
    const app = await bootstrapApp({ assertMembership });

    const response = await request(app.getHttpServer())
      .post("/casos/fc8f1934-c72c-49d4-88a5-202797b30da7/invitaciones")
      .set("Authorization", "Bearer 2549140f-3853-4bd8-8593-0f68ab627390")
      .send({ tipo: "link" });

    expect(response.status).toBe(404);
    await app.close();
  });

  it("activates a case on a successful join, returning the activated case", async () => {
    const joinCase = jest.fn().mockResolvedValue({
      id: "fc8f1934-c72c-49d4-88a5-202797b30da7",
      estado: "activo",
    });
    const app = await bootstrapApp({
      assertMembership: jest.fn(),
      joinCase,
    });

    const response = await request(app.getHttpServer())
      .post("/casos/unirse")
      .set("Authorization", "Bearer 2549140f-3853-4bd8-8593-0f68ab627390")
      .send({ token: "2acea42e-bb57-44d6-8ad3-aad955ec50af" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "fc8f1934-c72c-49d4-88a5-202797b30da7",
      estado: "activo",
    });
    expect(joinCase).toHaveBeenCalledWith(
      "2acea42e-bb57-44d6-8ad3-aad955ec50af",
      "2549140f-3853-4bd8-8593-0f68ab627390",
      "b@b.com",
    );
    await app.close();
  });

  it("rejects an expired token with a uniform 404", async () => {
    const joinCase = jest
      .fn()
      .mockRejectedValue(
        new HttpException(
          { code: "invalid_token", message: "Invalid or used token" },
          404,
        ),
      );
    const app = await bootstrapApp({ assertMembership: jest.fn(), joinCase });

    const response = await request(app.getHttpServer())
      .post("/casos/unirse")
      .set("Authorization", "Bearer 2549140f-3853-4bd8-8593-0f68ab627390")
      .send({ token: "2acea42e-bb57-44d6-8ad3-aad955ec50af" });

    expect(response.status).toBe(404);
    await app.close();
  });

  it("rejects an email-mismatch join with a uniform 403, distinct from token invalidity", async () => {
    const joinCase = jest.fn().mockRejectedValue(
      new HttpException(
        {
          code: "forbidden",
          message: "Invitation email does not match the caller",
        },
        403,
      ),
    );
    const app = await bootstrapApp({ assertMembership: jest.fn(), joinCase });

    const response = await request(app.getHttpServer())
      .post("/casos/unirse")
      .set("Authorization", "Bearer 2549140f-3853-4bd8-8593-0f68ab627390")
      .send({ token: "2acea42e-bb57-44d6-8ad3-aad955ec50af" });

    expect(response.status).toBe(403);
    expect(joinCase).toHaveBeenCalledWith(
      "2acea42e-bb57-44d6-8ad3-aad955ec50af",
      "2549140f-3853-4bd8-8593-0f68ab627390",
      "b@b.com",
    );
    await app.close();
  });

  const casoId = "7a2d7f52-1d44-4a53-9f66-2c4b8b0a6a11";
  const invitacionId = "3c0f9a1e-5f2b-4f8e-9a77-6d9f1c2b3a44";

  it("resends an invitation for the case creator, keeping the token", async () => {
    const assertMembership = jest.fn().mockResolvedValue({
      rol_en_caso: "parte_a",
    });
    const refreshInvite = jest.fn().mockResolvedValue({
      id: invitacionId,
      tipo: "codigo",
      token: "tok-abc",
      estado: "pendiente",
      email_destino: null,
      pago_a_cargo: null,
    });
    const app = await bootstrapApp({ assertMembership, refreshInvite });

    const response = await request(app.getHttpServer())
      .post(`/casos/${casoId}/invitaciones/${invitacionId}/reenviar`)
      .set("Authorization", "Bearer ba513e5d-1619-4430-8d09-0b44b34598d5")
      .send();

    expect(response.status).toBe(201);
    expect(response.body.token).toBe("tok-abc");
    expect(refreshInvite).toHaveBeenCalledWith(invitacionId, casoId, null);
    await app.close();
  });

  it("regenerates the code for the case creator with a fresh token", async () => {
    const assertMembership = jest.fn().mockResolvedValue({
      rol_en_caso: "parte_a",
    });
    const refreshInvite = jest.fn().mockResolvedValue({
      id: invitacionId,
      tipo: "codigo",
      token: "tok-nuevo",
      estado: "pendiente",
      email_destino: null,
      pago_a_cargo: null,
    });
    const app = await bootstrapApp({ assertMembership, refreshInvite });

    const response = await request(app.getHttpServer())
      .post(`/casos/${casoId}/invitaciones/${invitacionId}/regenerar`)
      .set("Authorization", "Bearer ba513e5d-1619-4430-8d09-0b44b34598d5")
      .send();

    expect(response.status).toBe(201);
    expect(response.body.token).toBe("tok-nuevo");
    const [, , nuevoToken] = refreshInvite.mock.calls[0] ?? [];
    expect(typeof nuevoToken).toBe("string");
    expect(nuevoToken).not.toBeNull();
    await app.close();
  });

  it("refuses to resend for parte_b with a 403, touching no rows", async () => {
    const assertMembership = jest.fn().mockResolvedValue({
      rol_en_caso: "parte_b",
    });
    const refreshInvite = jest.fn();
    const app = await bootstrapApp({ assertMembership, refreshInvite });

    const response = await request(app.getHttpServer())
      .post(`/casos/${casoId}/invitaciones/${invitacionId}/reenviar`)
      .set("Authorization", "Bearer 2549140f-3853-4bd8-8593-0f68ab627390")
      .send();

    expect(response.status).toBe(403);
    expect(refreshInvite).not.toHaveBeenCalled();
    await app.close();
  });
});
