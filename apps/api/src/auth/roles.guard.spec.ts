import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Controller, Get, HttpException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { AuthGuard } from "./auth.guard";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "./authenticated-user";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import type { VerifiedClaims } from "./token-verifier";
import { TOKEN_VERIFIER } from "./token-verifier";
import { UsersRepository } from "./users.repository";

function createContext(
  authenticatedRequest: AuthenticatedRequest,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => authenticatedRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createReflector(requiredRoles: unknown): Reflector {
  return { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
}

describe("RolesGuard", () => {
  it("proceeds when no @Roles metadata is present", () => {
    const guard = new RolesGuard(createReflector(undefined));
    const context = createContext({
      headers: {},
      user: { id: "user-1", email: "a@b.com", rol: "parte" },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("proceeds when the caller role is in the required set", () => {
    const guard = new RolesGuard(createReflector(["admin"]));
    const context = createContext({
      headers: {},
      user: { id: "user-1", email: "a@b.com", rol: "admin" },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects with 403 and a uniform body when the caller role is not in the required set", () => {
    const guard = new RolesGuard(createReflector(["admin"]));
    const context = createContext({
      headers: {},
      user: { id: "user-1", email: "a@b.com", rol: "parte" },
    });

    let thrown: unknown;
    try {
      guard.canActivate(context);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(403);
    expect((thrown as HttpException).getResponse()).toEqual({
      code: "forbidden_role",
      message: "Caller role is not permitted for this route",
    });
  });
});

describe("AuthGuard and RolesGuard registration order", () => {
  @Controller("test-roles")
  class TestRolesController {
    @Get()
    @Roles("admin")
    handle() {
      return { ok: true };
    }
  }

  async function bootstrapApp(options: {
    verify: jest.Mock;
    findAuthById: jest.Mock;
  }): Promise<INestApplication> {
    const moduleReference = await Test.createTestingModule({
      controllers: [TestRolesController],
      providers: [
        { provide: TOKEN_VERIFIER, useValue: { verify: options.verify } },
        {
          provide: UsersRepository,
          useValue: { findAuthById: options.findAuthById },
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

  it("rejects with 401 before RolesGuard runs when the token is missing", async () => {
    const verify = jest.fn();
    const findAuthById = jest.fn();
    const app = await bootstrapApp({ verify, findAuthById });

    const response = await request(app.getHttpServer()).get("/test-roles");

    expect(response.status).toBe(401);
    expect(findAuthById).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects with 403 when AuthGuard attaches an insufficient role", async () => {
    const claims: VerifiedClaims = { sub: "user-1" };
    const user: AuthenticatedUser = {
      id: "user-1",
      email: "a@b.com",
      rol: "parte",
    };
    const verify = jest.fn().mockResolvedValue(claims);
    const findAuthById = jest.fn().mockResolvedValue(user);
    const app = await bootstrapApp({ verify, findAuthById });

    const response = await request(app.getHttpServer())
      .get("/test-roles")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "forbidden_role",
        message: "Caller role is not permitted for this route",
      },
    });
    await app.close();
  });

  it("proceeds when AuthGuard attaches a sufficient role", async () => {
    const claims: VerifiedClaims = { sub: "user-1" };
    const user: AuthenticatedUser = {
      id: "user-1",
      email: "a@b.com",
      rol: "admin",
    };
    const verify = jest.fn().mockResolvedValue(claims);
    const findAuthById = jest.fn().mockResolvedValue(user);
    const app = await bootstrapApp({ verify, findAuthById });

    const response = await request(app.getHttpServer())
      .get("/test-roles")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    await app.close();
  });
});
