import type { ExecutionContext } from "@nestjs/common";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "./authenticated-user";
import { currentUserFactory } from "./current-user.decorator";

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("currentUserFactory", () => {
  it("returns the attached authenticated user", () => {
    const user: AuthenticatedUser = {
      id: "user-1",
      email: "a@b.com",
      rol: "parte",
    };
    const context = createContext({ headers: {}, user });

    expect(currentUserFactory(undefined, context)).toBe(user);
  });

  it("returns undefined when no user is attached", () => {
    const context = createContext({ headers: {} });

    expect(currentUserFactory(undefined, context)).toBeUndefined();
  });
});
