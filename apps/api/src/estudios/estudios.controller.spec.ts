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
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { KYSELY } from "../database/database.tokens";
import { CarpetasRepository } from "./carpetas.repository";
import { EstudioMembershipService } from "./estudio-membership.service";
import { EstudiosController } from "./estudios.controller";
import { EstudiosRepository } from "./estudios.repository";
import { EstudiosService } from "./estudios.service";

const estudioAUser: AuthenticatedUser = {
  id: "ba513e5d-1619-4430-8d09-0b44b34598d5",
  email: "a@b.com",
  rol: "estudio",
};
const estudioBUser: AuthenticatedUser = {
  id: "2549140f-3853-4bd8-8593-0f68ab627390",
  email: "b@b.com",
  rol: "estudio",
};
const parteUser: AuthenticatedUser = {
  id: "c162106b-c6f2-414b-8220-1d58bbcffbb1",
  email: "parte@b.com",
  rol: "parte",
};
const mediadorUser: AuthenticatedUser = {
  id: "ff98c117-2489-44e9-8cc7-1cd54c769927",
  email: "mediador@b.com",
  rol: "mediador",
};
const adminUser: AuthenticatedUser = {
  id: "7c10223c-5106-48f3-8d16-c4eb18aed5c3",
  email: "admin@b.com",
  rol: "admin",
};

const knownUsers = [
  estudioAUser,
  estudioBUser,
  parteUser,
  mediadorUser,
  adminUser,
];

const estudioByUser: Record<string, string> = {
  "ba513e5d-1619-4430-8d09-0b44b34598d5":
    "9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1",
  "2549140f-3853-4bd8-8593-0f68ab627390":
    "993fae44-dbb0-4d81-86ef-9b6b7570a2da",
};

function createFakeMembershipService() {
  return {
    assertEstudioAccess: jest.fn(
      (callerId: string, callerRole: string, pathId: string) => {
        if (callerRole === "admin") {
          return Promise.resolve(pathId);
        }
        if (estudioByUser[callerId] === pathId) {
          return Promise.resolve(pathId);
        }
        return Promise.reject(
          new HttpException(
            { code: "estudio_not_found", message: "Estudio not found" },
            404,
          ),
        );
      },
    ),
  };
}

describe("EstudiosController end-to-end isolation", () => {
  let app: INestApplication;
  let listCasosByCarpeta: jest.Mock;
  let createCarpeta: jest.Mock;
  let findOwn: jest.Mock;
  let updateMarcaConfig: jest.Mock;
  let membershipService: ReturnType<typeof createFakeMembershipService>;

  beforeEach(async () => {
    listCasosByCarpeta = jest.fn((estudioId: string) => {
      if (estudioId === "9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1") {
        return Promise.resolve([
          {
            id: "5778d5d8-18f8-41df-8cef-fec3e4c4b8e2",
            nombre: "Divorcio A",
            estado: "nuevo",
            metodo: "mediacion",
            created_at: "now",
            carpeta_id: "72d7b015-cd45-4d52-8353-13592c4f8313",
            carpeta_nombre: "Familia",
          },
        ]);
      }
      return Promise.resolve([]);
    });
    createCarpeta = jest.fn((estudioId: string, nombre: string) =>
      Promise.resolve({
        id: "066b3483-4108-4a38-8e6c-cba375f03b9e",
        estudio_id: estudioId,
        nombre,
        created_at: "now",
        updated_at: "now",
      }),
    );
    findOwn = jest.fn((estudioId: string) =>
      Promise.resolve({
        id: estudioId,
        nombre: "Estudio",
        marca_config: { color: "#fff" },
        plan_id: null,
        activo: true,
        created_at: "now",
        updated_at: "now",
      }),
    );
    updateMarcaConfig = jest.fn((estudioId: string, marcaConfig: unknown) =>
      Promise.resolve({
        id: estudioId,
        nombre: "Estudio",
        marca_config: marcaConfig,
        plan_id: null,
        activo: true,
        created_at: "now",
        updated_at: "now",
      }),
    );
    membershipService = createFakeMembershipService();

    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(knownUsers.find((user) => user.id === id)),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [EstudiosController],
      providers: [
        EstudiosService,
        {
          provide: CarpetasRepository,
          useValue: { listCasosByCarpeta, createCarpeta },
        },
        {
          provide: EstudiosRepository,
          useValue: { findOwn, updateMarcaConfig },
        },
        { provide: EstudioMembershipService, useValue: membershipService },
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

    app = moduleReference.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects unauthenticated GET /estudios/:id/casos with 401", async () => {
    const response = await request(app.getHttpServer()).get(
      "/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/casos",
    );

    expect(response.status).toBe(401);
    expect(listCasosByCarpeta).not.toHaveBeenCalled();
  });

  it("rejects a parte caller with 403 and never touches the repository", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/casos")
      .set("Authorization", `Bearer ${parteUser.id}`);

    expect(response.status).toBe(403);
    expect(listCasosByCarpeta).not.toHaveBeenCalled();
  });

  it("rejects a mediador caller with 403", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/casos")
      .set("Authorization", `Bearer ${mediadorUser.id}`);

    expect(response.status).toBe(403);
  });

  it("returns the caller's own casos grouped by carpeta", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/casos")
      .set("Authorization", `Bearer ${estudioAUser.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        carpeta: {
          id: "72d7b015-cd45-4d52-8353-13592c4f8313",
          nombre: "Familia",
        },
        casos: [
          {
            id: "5778d5d8-18f8-41df-8cef-fec3e4c4b8e2",
            nombre: "Divorcio A",
            estado: "nuevo",
            metodo: "mediacion",
            created_at: "now",
          },
        ],
      },
    ]);
  });

  it("returns 404 (not 403) when estudio B's caller targets estudio A's casos, leaking nothing", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/casos")
      .set("Authorization", `Bearer ${estudioBUser.id}`);

    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain("Familia");
    expect(JSON.stringify(response.body)).not.toContain(
      "5778d5d8-18f8-41df-8cef-fec3e4c4b8e2",
    );
    expect(listCasosByCarpeta).not.toHaveBeenCalled();
  });

  it("lets an admin read any estudio's casos regardless of their own estudio_id", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/casos")
      .set("Authorization", `Bearer ${adminUser.id}`);

    expect(response.status).toBe(200);
    expect(listCasosByCarpeta).toHaveBeenCalledWith(
      "9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1",
    );
  });

  it("creates a carpeta scoped to the caller's own estudio", async () => {
    const response = await request(app.getHttpServer())
      .post("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/carpetas")
      .set("Authorization", `Bearer ${estudioAUser.id}`)
      .send({ nombre: "Familia" });

    expect(response.status).toBe(201);
    expect(createCarpeta).toHaveBeenCalledWith(
      "9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1",
      "Familia",
    );
    expect(response.body).toEqual({
      id: "066b3483-4108-4a38-8e6c-cba375f03b9e",
    });
  });

  it("returns 404 and creates no carpeta when estudio B targets estudio A", async () => {
    const response = await request(app.getHttpServer())
      .post("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/carpetas")
      .set("Authorization", `Bearer ${estudioBUser.id}`)
      .send({ nombre: "Familia" });

    expect(response.status).toBe(404);
    expect(createCarpeta).not.toHaveBeenCalled();
  });

  it("rejects an empty nombre with 400 and creates no carpeta", async () => {
    const response = await request(app.getHttpServer())
      .post("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/carpetas")
      .set("Authorization", `Bearer ${estudioAUser.id}`)
      .send({ nombre: "  " });

    expect(response.status).toBe(400);
    expect(createCarpeta).not.toHaveBeenCalled();
  });

  it("returns the caller's own marca_config", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1")
      .set("Authorization", `Bearer ${estudioAUser.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ marca_config: { color: "#fff" } });
  });

  it("returns 404 when estudio B's caller reads estudio A's marca_config", async () => {
    const response = await request(app.getHttpServer())
      .get("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1")
      .set("Authorization", `Bearer ${estudioBUser.id}`);

    expect(response.status).toBe(404);
    expect(findOwn).not.toHaveBeenCalled();
  });

  it("fully replaces the caller's own marca_config", async () => {
    const response = await request(app.getHttpServer())
      .patch("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/marca-config")
      .set("Authorization", `Bearer ${estudioAUser.id}`)
      .send({ color: "#000" });

    expect(response.status).toBe(200);
    expect(updateMarcaConfig).toHaveBeenCalledWith(
      "9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1",
      {
        color: "#000",
      },
    );
    expect(response.body).toEqual({ marca_config: { color: "#000" } });
  });

  it("rejects a non-object marca_config payload with 400 and does not modify anything", async () => {
    const response = await request(app.getHttpServer())
      .patch("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/marca-config")
      .set("Authorization", `Bearer ${estudioAUser.id}`)
      .set("Content-Type", "application/json")
      .send('"a-string"');

    expect(response.status).toBe(400);
    expect(updateMarcaConfig).not.toHaveBeenCalled();
  });

  it("returns 404 and never modifies estudio A when estudio B PATCHes estudio A's marca_config", async () => {
    const response = await request(app.getHttpServer())
      .patch("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/marca-config")
      .set("Authorization", `Bearer ${estudioBUser.id}`)
      .send({ color: "#000" });

    expect(response.status).toBe(404);
    expect(updateMarcaConfig).not.toHaveBeenCalled();
  });
});

describe("POST /estudios/:id/carpetas pg-error mapping end-to-end", () => {
  function createFakeInsertKysely(rejection: unknown) {
    const executeTakeFirstOrThrow = jest.fn().mockRejectedValue(rejection);
    const returningAll = jest.fn().mockReturnValue({
      executeTakeFirstOrThrow,
    });
    const values = jest.fn().mockReturnValue({ returningAll });
    const insertInto = jest.fn().mockReturnValue({ values });
    return { insertInto, values, returningAll, executeTakeFirstOrThrow };
  }

  it("maps a pg unique-violation raised during carpeta creation to a uniform 409 with no leaked db detail", async () => {
    const pgError = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "carpetas_estudio_id_nombre_key"',
    };
    const fakeKysely = createFakeInsertKysely(pgError);

    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(id === adminUser.id ? adminUser : undefined),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [EstudiosController],
      providers: [
        EstudiosService,
        CarpetasRepository,
        EstudiosRepository,
        EstudioMembershipService,
        { provide: KYSELY, useValue: fakeKysely },
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

    const response = await request(app.getHttpServer())
      .post("/estudios/9e93c3cd-c7e4-426c-8cbb-ba213aafd7b1/carpetas")
      .set("Authorization", `Bearer ${adminUser.id}`)
      .send({ nombre: "Familia" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: "conflict", message: "Conflict" },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "carpetas_estudio_id_nombre_key",
    );
    await app.close();
  });
});
