import type { INestApplication } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { UsersRepository } from "../auth/users.repository";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { KYSELY } from "../database/database.tokens";
import { CasosController } from "./casos.controller";
import { CasosRepository } from "./casos.repository";
import { CasosService } from "./casos.service";
import { MembershipService } from "./membership.service";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};
const stranger: AuthenticatedUser = {
  id: "user-c",
  email: "c@b.com",
  rol: "parte",
};

describe("CasosController unit", () => {
  it("creates a case for the authenticated caller", async () => {
    const createCase = jest
      .fn()
      .mockResolvedValue({ id: "caso-1", estado: "nuevo" });
    const controller = new CasosController({
      createCase,
      listOwnCases: jest.fn(),
      getCaseDetail: jest.fn(),
    } as unknown as CasosService);

    const result = await controller.createCase(parteA, {
      nombre: "Divorcio",
      metodo: "mediacion",
    });

    expect(createCase).toHaveBeenCalledWith("user-a", {
      nombre: "Divorcio",
      metodo: "mediacion",
    });
    expect(result).toEqual({ id: "caso-1", estado: "nuevo" });
  });
});

describe("POST/GET /casos end-to-end isolation", () => {
  const casoPartesByCase: Record<string, Set<string>> = {
    "caso-x": new Set(["user-a"]),
  };
  const casesById: Record<
    string,
    { id: string; nombre: string; estado: string; metodo: string }
  > = {
    "caso-x": {
      id: "caso-x",
      nombre: "Divorcio",
      estado: "nuevo",
      metodo: "mediacion",
    },
  };

  async function bootstrapApp(): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve([parteA, stranger].find((user) => user.id === id)),
    };
    const casosRepository = {
      createCaseWithParteA: jest.fn(),
      findOwnCases: jest.fn(),
      findDetailForMember: (casoId: string, callerId: string) =>
        Promise.resolve(
          casoPartesByCase[casoId]?.has(callerId)
            ? casesById[casoId]
            : undefined,
        ),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [CasosController],
      providers: [
        CasosService,
        { provide: CasosRepository, useValue: casosRepository },
        {
          provide: MembershipService,
          useValue: {
            assertMembership: (casoId: string, callerId: string) => {
              if (casoPartesByCase[casoId]?.has(callerId)) {
                return Promise.resolve({});
              }
              return Promise.reject(
                new HttpException(
                  { code: "caso_not_found", message: "Case not found" },
                  404,
                ),
              );
            },
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

  it("returns the case detail to an accepted member", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer())
      .get("/casos/caso-x")
      .set("Authorization", "Bearer user-a");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(casesById["caso-x"]);
    await app.close();
  });

  it("returns 404 (not 403) for a non-member", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer())
      .get("/casos/caso-x")
      .set("Authorization", "Bearer user-c");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "caso_not_found", message: "Case not found" },
    });
    await app.close();
  });

  it("rejects unauthenticated POST /casos with 401", async () => {
    const app = await bootstrapApp();

    const response = await request(app.getHttpServer())
      .post("/casos")
      .send({ nombre: "Divorcio", metodo: "mediacion" });

    expect(response.status).toBe(401);
    await app.close();
  });
});

describe("POST /casos pg-error mapping end-to-end", () => {
  function createFakeKyselyWithParteRejection(
    insertedCaso: unknown,
    parteError: unknown,
  ) {
    const casoExecuteTakeFirstOrThrow = jest
      .fn()
      .mockResolvedValue(insertedCaso);
    const casoReturningAll = jest.fn().mockReturnValue({
      executeTakeFirstOrThrow: casoExecuteTakeFirstOrThrow,
    });
    const casoValues = jest
      .fn()
      .mockReturnValue({ returningAll: casoReturningAll });

    const parteExecute = jest.fn().mockRejectedValue(parteError);
    const parteValues = jest.fn().mockReturnValue({ execute: parteExecute });

    const insertInto = jest.fn((table: string) => {
      if (table === "casos") {
        return { values: casoValues };
      }
      return { values: parteValues };
    });

    const trx = { insertInto };
    const execute = jest.fn((callback: (trx: unknown) => unknown) =>
      callback(trx),
    );
    const transaction = jest.fn().mockReturnValue({ execute });
    return { transaction };
  }

  async function bootstrapAppWithRealRepository(
    fakeKysely: unknown,
  ): Promise<INestApplication> {
    const usersRepository = {
      findAuthById: (id: string) =>
        Promise.resolve(id === parteA.id ? parteA : undefined),
    };

    const moduleReference = await Test.createTestingModule({
      controllers: [CasosController],
      providers: [
        CasosService,
        CasosRepository,
        MembershipService,
        { provide: KYSELY, useValue: fakeKysely },
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

  it("maps a pg unique-violation raised during case creation to a uniform 409 with no leaked db detail", async () => {
    const pgError = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "caso_partes_caso_id_usuario_id_key"',
    };
    const fakeKysely = createFakeKyselyWithParteRejection(
      { id: "caso-1", estado: "nuevo" },
      pgError,
    );
    const app = await bootstrapAppWithRealRepository(fakeKysely);

    const response = await request(app.getHttpServer())
      .post("/casos")
      .set("Authorization", "Bearer user-a")
      .send({ nombre: "Divorcio", metodo: "mediacion" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: { code: "conflict", message: "Conflict" },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "caso_partes_caso_id_usuario_id_key",
    );
    await app.close();
  });
});
