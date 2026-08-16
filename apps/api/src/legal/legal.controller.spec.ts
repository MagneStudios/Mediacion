import type { AuthenticatedUser } from "../auth/authenticated-user";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { ROLES_KEY } from "../auth/roles.decorator";
import type { TokenVerifier } from "../auth/token-verifier";
import { LegalController } from "./legal.controller";
import type { LegalService } from "./legal.service";
import type { PublicRateLimiter } from "./rate-limiter";

describe("LegalController", () => {
  const caller: AuthenticatedUser = {
    id: "user-1",
    email: "ana@example.com",
    rol: "parte",
  };

  function buildController(options?: {
    getDocumentoVigente?: jest.Mock;
    registerAcceptance?: jest.Mock;
    getAcceptanceStatus?: jest.Mock;
    exportAcceptances?: jest.Mock;
    registerArrepentimiento?: jest.Mock;
    registerContacto?: jest.Mock;
    assertWithinLimit?: jest.Mock;
    verify?: jest.Mock;
  }) {
    const legalService = {
      getDocumentoVigente: options?.getDocumentoVigente ?? jest.fn(),
      registerAcceptance: options?.registerAcceptance ?? jest.fn(),
      getAcceptanceStatus: options?.getAcceptanceStatus ?? jest.fn(),
      exportAcceptances: options?.exportAcceptances ?? jest.fn(),
      registerArrepentimiento: options?.registerArrepentimiento ?? jest.fn(),
      registerContacto: options?.registerContacto ?? jest.fn(),
    } as unknown as LegalService;
    const rateLimiter = {
      assertWithinLimit: options?.assertWithinLimit ?? jest.fn(),
    } as unknown as PublicRateLimiter;
    const tokenVerifier = {
      verify: options?.verify ?? jest.fn().mockRejectedValue(new Error("no")),
    } as unknown as TokenVerifier;
    return {
      controller: new LegalController(legalService, rateLimiter, tokenVerifier),
      legalService,
      rateLimiter,
    };
  }

  it("delegates the public document read", async () => {
    const getDocumentoVigente = jest.fn().mockResolvedValue({ tipo: "terms" });
    const { controller } = buildController({ getDocumentoVigente });

    await controller.getDocumento("terms");

    expect(getDocumentoVigente).toHaveBeenCalledWith("terms");
  });

  it("builds the acceptance proof from the headers, not from the body", async () => {
    const registerAcceptance = jest.fn().mockResolvedValue(undefined);
    const { controller } = buildController({ registerAcceptance });

    await controller.registerAcceptance(
      caller,
      { marketing: true },
      "203.0.113.7",
      "Expo/1.0",
      "127.0.0.1",
    );

    expect(registerAcceptance).toHaveBeenCalledWith(
      "user-1",
      { marketing: true },
      { ip: "203.0.113.7", userAgent: "Expo/1.0" },
    );
  });

  it("delegates the acceptance status of the caller", async () => {
    const getAcceptanceStatus = jest
      .fn()
      .mockResolvedValue({ pendientes: [], requiere_reaceptacion: false });
    const { controller } = buildController({ getAcceptanceStatus });

    await controller.getAcceptanceStatus(caller);

    expect(getAcceptanceStatus).toHaveBeenCalledWith("user-1");
  });

  it("sends the export as an attachment", async () => {
    const exportAcceptances = jest
      .fn()
      .mockResolvedValue({ filename: "aceptaciones.csv", csv: "user_id\r\n" });
    const { controller } = buildController({ exportAcceptances });
    const setHeader = jest.fn();

    const body = await controller.exportAcceptances(
      { version: "v1.0" },
      { setHeader, send: jest.fn() },
    );

    expect(exportAcceptances).toHaveBeenCalledWith({ version: "v1.0" });
    expect(setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="aceptaciones.csv"',
    );
    expect(body).toBe("user_id\r\n");
  });

  it("rate limits the public arrepentimiento by ip before touching the service", async () => {
    const assertWithinLimit = jest.fn(() => {
      throw new Error("limited");
    });
    const registerArrepentimiento = jest.fn();
    const { controller } = buildController({
      assertWithinLimit,
      registerArrepentimiento,
    });

    await expect(
      controller.registerArrepentimiento({}, undefined, "203.0.113.7"),
    ).rejects.toThrow("limited");
    expect(assertWithinLimit).toHaveBeenCalledWith("203.0.113.7");
    expect(registerArrepentimiento).not.toHaveBeenCalled();
  });

  it("records the caller when the public request carries a valid token", async () => {
    const registerArrepentimiento = jest.fn().mockResolvedValue({});
    const { controller } = buildController({
      registerArrepentimiento,
      verify: jest.fn().mockResolvedValue({ sub: "user-9" }),
    });

    await controller.registerArrepentimiento(
      { nombre: "Ana" },
      "Bearer token",
      "203.0.113.7",
    );

    expect(registerArrepentimiento).toHaveBeenCalledWith(
      { nombre: "Ana" },
      "user-9",
    );
  });

  it("accepts an anonymous contact request", async () => {
    const registerContacto = jest.fn().mockResolvedValue({});
    const { controller } = buildController({ registerContacto });

    await controller.registerContacto({ nombre: "Ana" }, undefined, "1.1.1.1");

    expect(registerContacto).toHaveBeenCalledWith({ nombre: "Ana" }, null);
  });

  describe("route gates", () => {
    it.each([
      ["getDocumento"],
      ["registerArrepentimiento"],
      ["registerContacto"],
    ])("keeps %s reachable without a session", (handler) => {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          LegalController.prototype[handler as keyof LegalController] as object,
        ),
      ).toBe(true);
    });

    it.each([
      ["registerAcceptance"],
      ["getAcceptanceStatus"],
      ["exportAcceptances"],
    ])("keeps %s behind the guard", (handler) => {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          LegalController.prototype[handler as keyof LegalController] as object,
        ),
      ).toBeUndefined();
    });

    it("restricts the acceptance log export to admins", () => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          LegalController.prototype.exportAcceptances as object,
        ),
      ).toEqual(["admin"]);
    });
  });
});
