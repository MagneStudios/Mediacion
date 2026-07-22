import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser, MeProfile } from "../auth/authenticated-user";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

const caller: AuthenticatedUser = {
  id: "user-1",
  email: "a@b.com",
  rol: "parte",
};

describe("MeController", () => {
  it("returns the caller's own profile", async () => {
    const profile: MeProfile = {
      id: "user-1",
      rol: "parte",
      nombre: "Ana",
      apellido: "Diaz",
      email: "a@b.com",
      telefono: null,
      idioma: "es",
      verif_biometrica: "pendiente",
      estudio_id: null,
      activo: true,
    };
    const findOwnProfile = jest.fn().mockResolvedValue(profile);
    const controller = new MeController({
      findOwnProfile,
    } as unknown as MeService);

    const result = await controller.getOwnProfile(caller);

    expect(findOwnProfile).toHaveBeenCalledWith("user-1");
    expect(result).toBe(profile);
  });

  it("throws 404 profile_not_found when the repository finds no row", async () => {
    const findOwnProfile = jest.fn().mockResolvedValue(undefined);
    const controller = new MeController({
      findOwnProfile,
    } as unknown as MeService);

    let thrown: unknown;
    try {
      await controller.getOwnProfile(caller);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
    expect((thrown as HttpException).getResponse()).toEqual({
      code: "profile_not_found",
      message: "Profile not found",
    });
  });
});

describe("GET /me end-to-end isolation", () => {
  const authenticatedUsers: Record<string, AuthenticatedUser> = {
    "user-a": { id: "user-a", email: "a@b.com", rol: "parte" },
    "user-b": { id: "user-b", email: "b@b.com", rol: "parte" },
  };
  const profiles: Record<string, MeProfile> = {
    "user-a": {
      id: "user-a",
      rol: "parte",
      nombre: "Ana",
      apellido: "Uno",
      email: "a@b.com",
      telefono: null,
      idioma: "es",
      verif_biometrica: "pendiente",
      estudio_id: null,
      activo: true,
    },
    "user-b": {
      id: "user-b",
      rol: "parte",
      nombre: "Bea",
      apellido: "Dos",
      email: "b@b.com",
      telefono: null,
      idioma: "es",
      verif_biometrica: "pendiente",
      estudio_id: null,
      activo: true,
    },
  };

  async function bootstrapApp(): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) => Promise.resolve(authenticatedUsers[id]),
      findProfileById: (id: string) => Promise.resolve(profiles[id]),
    };
    const moduleReference = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        MeService,
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

  it("returns only the calling user's profile for user A", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(profiles["user-a"]);
    await app.close();
  });

  it("returns only the calling user's profile for user B, and a query-string id is ignored", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer())
      .get("/me?id=user-a")
      .set("Authorization", "Bearer user-b");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(profiles["user-b"]);
    await app.close();
  });

  it("rejects with 401 when no token is provided", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer()).get("/me");

    expect(response.status).toBe(401);
    await app.close();
  });
});
