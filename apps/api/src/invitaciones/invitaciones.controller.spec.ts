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
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};
const parteB: AuthenticatedUser = {
  id: "user-b",
  email: "b@b.com",
  rol: "parte",
};

describe("InvitacionesController unit", () => {
  it("creates an invitation using the caso id, caller id and body", async () => {
    const createInvitation = jest.fn().mockResolvedValue({
      id: "inv-1",
      tipo: "link",
      token: "tok-1",
      estado: "pendiente",
    });
    const controller = new InvitacionesController({
      createInvitation,
      joinCase: jest.fn(),
    } as unknown as InvitacionesService);

    const result = await controller.createInvitation("caso-1", parteA, {
      tipo: "link",
    });

    expect(createInvitation).toHaveBeenCalledWith("caso-1", "user-a", {
      tipo: "link",
    });
    expect(result).toEqual({
      id: "inv-1",
      tipo: "link",
      token: "tok-1",
      estado: "pendiente",
    });
  });

  it("joins a case using the token and caller id", async () => {
    const joinCase = jest
      .fn()
      .mockResolvedValue({ id: "caso-1", estado: "activo" });
    const controller = new InvitacionesController({
      createInvitation: jest.fn(),
      joinCase,
    } as unknown as InvitacionesService);

    const result = await controller.joinCase(parteB, { token: "tok-1" });

    expect(joinCase).toHaveBeenCalledWith("tok-1", "user-b", "b@b.com");
    expect(result).toEqual({ id: "caso-1", estado: "activo" });
  });
});

describe("POST /casos/unirse and /casos/:id/invitaciones end-to-end", () => {
  async function bootstrapApp(overrides: {
    assertMembership: jest.Mock;
    createInvite?: jest.Mock;
    joinCase?: jest.Mock;
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
      .send({ token: "tok-1" });

    expect(response.status).toBe(401);
    await app.close();
  });

  it("creates an invitation for the case creator", async () => {
    const assertMembership = jest.fn().mockResolvedValue({
      rol_en_caso: "parte_a",
    });
    const createInvite = jest.fn().mockResolvedValue({
      id: "inv-1",
      tipo: "link",
      token: "tok-1",
      estado: "pendiente",
    });
    const app = await bootstrapApp({ assertMembership, createInvite });

    const response = await request(app.getHttpServer())
      .post("/casos/caso-1/invitaciones")
      .set("Authorization", "Bearer user-a")
      .send({ tipo: "link" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "inv-1",
      tipo: "link",
      token: "tok-1",
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
      .post("/casos/caso-1/invitaciones")
      .set("Authorization", "Bearer user-b")
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
      .post("/casos/caso-1/invitaciones")
      .set("Authorization", "Bearer user-b")
      .send({ tipo: "link" });

    expect(response.status).toBe(404);
    await app.close();
  });

  it("activates a case on a successful join, returning the activated case", async () => {
    const joinCase = jest
      .fn()
      .mockResolvedValue({ id: "caso-1", estado: "activo" });
    const app = await bootstrapApp({
      assertMembership: jest.fn(),
      joinCase,
    });

    const response = await request(app.getHttpServer())
      .post("/casos/unirse")
      .set("Authorization", "Bearer user-b")
      .send({ token: "tok-1" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "caso-1", estado: "activo" });
    expect(joinCase).toHaveBeenCalledWith("tok-1", "user-b", "b@b.com");
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
      .set("Authorization", "Bearer user-b")
      .send({ token: "tok-1" });

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
      .set("Authorization", "Bearer user-b")
      .send({ token: "tok-1" });

    expect(response.status).toBe(403);
    expect(joinCase).toHaveBeenCalledWith("tok-1", "user-b", "b@b.com");
    await app.close();
  });
});
