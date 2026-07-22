import type { ExecutionContext } from "@nestjs/common";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "./authenticated-user";
import type { TokenVerifier, VerifiedClaims } from "./token-verifier";
import type { UsersRepository } from "./users.repository";

const provisionedUser: AuthenticatedUser = {
  id: "user-1",
  email: "a@b.com",
  rol: "admin",
};

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createReflector(isPublic: boolean): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

function createGuard(options: {
  verify?: TokenVerifier["verify"];
  findAuthById?: UsersRepository["findAuthById"];
  isPublic?: boolean;
}): AuthGuard {
  const tokenVerifier: TokenVerifier = {
    verify: options.verify ?? jest.fn(),
  };
  const usersRepository = {
    findAuthById: options.findAuthById ?? jest.fn(),
  } as UsersRepository;
  const reflector = createReflector(options.isPublic ?? false);
  return new AuthGuard(tokenVerifier, usersRepository, reflector);
}

async function captureThrown(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

describe("AuthGuard", () => {
  it("rejects with 401 when the Authorization header is missing", async () => {
    const guard = createGuard({});
    const context = createContext({ headers: {} });

    const error = await captureThrown(guard.canActivate(context));

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
  });

  it("rejects with 401 when the Authorization header uses a non-Bearer scheme", async () => {
    const guard = createGuard({});
    const context = createContext({ headers: { authorization: "Basic abc" } });

    const error = await captureThrown(guard.canActivate(context));

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
  });

  it("rejects with 401 when the Bearer scheme has no token", async () => {
    const guard = createGuard({});
    const context = createContext({ headers: { authorization: "Bearer" } });

    const error = await captureThrown(guard.canActivate(context));

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
  });

  it("rejects with 401 and does not leak the verifier's internal rejection reason when the token is invalid or expired", async () => {
    const guard = createGuard({
      verify: jest
        .fn()
        .mockRejectedValue(
          new Error("JOSE_INTERNAL_MARKER: signature mismatch"),
        ),
    });
    const context = createContext({
      headers: { authorization: "Bearer some-token" },
    });

    const error = await captureThrown(guard.canActivate(context));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).message).toBe("Invalid or expired token");
    expect(
      JSON.stringify((error as HttpException).getResponse()),
    ).not.toContain("JOSE_INTERNAL_MARKER");
  });

  it("attaches the authenticated user and proceeds for a valid token with a provisioned user", async () => {
    const claims: VerifiedClaims = { sub: "user-1" };
    const guard = createGuard({
      verify: jest.fn().mockResolvedValue(claims),
      findAuthById: jest.fn().mockResolvedValue(provisionedUser),
    });
    const request: AuthenticatedRequest = {
      headers: { authorization: "Bearer valid-token" },
    };
    const context = createContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(provisionedUser);
  });

  it("rejects with 401 user_not_provisioned when the token is valid but no usuarios row exists", async () => {
    const claims: VerifiedClaims = { sub: "user-1" };
    const guard = createGuard({
      verify: jest.fn().mockResolvedValue(claims),
      findAuthById: jest.fn().mockResolvedValue(undefined),
    });
    const context = createContext({
      headers: { authorization: "Bearer valid-token" },
    });

    const error = await captureThrown(guard.canActivate(context));

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: "user_not_provisioned",
    });
  });

  it("allows the request through without verification when the route is marked @Public", async () => {
    const verify = jest.fn();
    const guard = createGuard({ verify, isPublic: true });
    const context = createContext({ headers: {} });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });
});
