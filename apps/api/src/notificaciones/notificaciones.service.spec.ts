import { Logger } from "@nestjs/common";
import type { NotificacionesRepository } from "./notificaciones.repository";
import { NotificacionesService } from "./notificaciones.service";
import type {
  EmailProvider,
  EmitNotificacionInput,
  PushProvider,
} from "./notificaciones.types";

describe("NotificacionesService", () => {
  function buildService(overrides?: {
    createPendiente?: jest.Mock;
    updateEstado?: jest.Mock;
    findRecipientEmail?: jest.Mock;
    emailProvider?: EmailProvider;
    pushProvider?: PushProvider;
  }) {
    const notificacionesRepository = {
      createPendiente:
        overrides?.createPendiente ??
        jest.fn().mockResolvedValue({ id: "notif-1" }),
      updateEstado:
        overrides?.updateEstado ?? jest.fn().mockResolvedValue(undefined),
      findRecipientEmail:
        overrides?.findRecipientEmail ??
        jest.fn().mockResolvedValue("party@example.com"),
    } as unknown as NotificacionesRepository;
    const emailProvider: EmailProvider = overrides?.emailProvider ?? {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const pushProvider: PushProvider = overrides?.pushProvider ?? {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NotificacionesService(
      notificacionesRepository,
      emailProvider,
      pushProvider,
    );
    return { service, notificacionesRepository, emailProvider, pushProvider };
  }

  const input: EmitNotificacionInput = {
    usuarioId: "user-1",
    casoId: "caso-1",
    canal: "email",
    evento: "invitacion_enviada",
  };

  describe("emit", () => {
    it("inserts a pendiente row without awaiting delivery, returning synchronously", () => {
      const createPendiente = jest.fn().mockReturnValue(new Promise(() => {}));
      const { service } = buildService({ createPendiente });

      const result = service.emit(input);

      expect(result).toBeUndefined();
      expect(createPendiente).toHaveBeenCalledWith(input);
    });

    it("returns before a slow provider settles", () => {
      const neverSettles = new Promise<void>(() => {});
      const slowSend = jest.fn().mockReturnValue(neverSettles);
      const { service } = buildService({ emailProvider: { send: slowSend } });

      const result = service.emit(input);

      expect(result).toBeUndefined();
    });

    it("logs without throwing when persisting the pendiente row rejects", async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const createPendiente = jest
        .fn()
        .mockRejectedValue(new Error("insert failed"));
      const { service } = buildService({ createPendiente });

      expect(() => service.emit(input)).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));

      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });

  describe("deliver", () => {
    it("sets estado to 'fallida' and logs correlation context when the provider throws, never rejecting the caller", async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const updateEstado = jest.fn().mockResolvedValue(undefined);
      const emailProvider: EmailProvider = {
        send: jest.fn().mockRejectedValue(new Error("smtp down")),
      };
      const { service } = buildService({ updateEstado, emailProvider });

      await expect(service.deliver(input)).resolves.toBeUndefined();

      expect(updateEstado).toHaveBeenCalledWith("notif-1", "fallida");
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("notif-1"),
      );
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("user-1"),
      );
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("email"),
      );
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("invitacion_enviada"),
      );
      loggerSpy.mockRestore();
    });

    it("sets estado to 'fallida' and logs when the push provider rejects, never rejecting the caller", async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const updateEstado = jest.fn().mockResolvedValue(undefined);
      const pushProvider: PushProvider = {
        send: jest.fn().mockRejectedValue(new Error("fcm down")),
      };
      const { service } = buildService({ updateEstado, pushProvider });

      await expect(
        service.deliver({ ...input, canal: "push", evento: "vencimiento" }),
      ).resolves.toBeUndefined();

      expect(updateEstado).toHaveBeenCalledWith("notif-1", "fallida");
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });

    it("leaves estado 'pendiente' and logs with the notification id when the send succeeds but marking 'enviada' rejects, without ever writing 'fallida'", async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const updateEstado = jest.fn().mockRejectedValue(new Error("db timeout"));
      const { service } = buildService({ updateEstado });

      await expect(service.deliver(input)).resolves.toBeUndefined();

      expect(updateEstado).toHaveBeenCalledWith("notif-1", "enviada");
      expect(updateEstado).not.toHaveBeenCalledWith("notif-1", "fallida");
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("notif-1"),
      );
      loggerSpy.mockRestore();
    });

    it("marks estado 'fallida' without calling the provider when the recipient email cannot be resolved", async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const findRecipientEmail = jest.fn().mockResolvedValue(undefined);
      const updateEstado = jest.fn().mockResolvedValue(undefined);
      const emailProvider: EmailProvider = { send: jest.fn() };
      const { service } = buildService({
        findRecipientEmail,
        updateEstado,
        emailProvider,
      });

      await service.deliver(input);

      expect(emailProvider.send).not.toHaveBeenCalled();
      expect(updateEstado).toHaveBeenCalledWith("notif-1", "fallida");
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("notif-1"),
      );
      expect(loggerSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining("user-1"),
      );
      loggerSpy.mockRestore();
    });

    it("persists the pendiente row before invoking the provider", async () => {
      const createPendiente = jest.fn().mockResolvedValue({ id: "notif-1" });
      const send = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({
        createPendiente,
        emailProvider: { send },
      });

      await service.deliver(input);

      const createOrder = createPendiente.mock.invocationCallOrder[0];
      const sendOrder = send.mock.invocationCallOrder[0];
      expect(createOrder).toBeLessThan(sendOrder);
    });

    it("sets estado to 'enviada' when the provider resolves", async () => {
      const updateEstado = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ updateEstado });

      await service.deliver(input);

      expect(updateEstado).toHaveBeenCalledWith("notif-1", "enviada");
    });

    it("resolves the recipient email and dispatches via the email provider for canal 'email'", async () => {
      const findRecipientEmail = jest
        .fn()
        .mockResolvedValue("party@example.com");
      const emailProvider: EmailProvider = {
        send: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = buildService({ findRecipientEmail, emailProvider });

      await service.deliver(input);

      expect(findRecipientEmail).toHaveBeenCalledWith("user-1");
      expect(emailProvider.send).toHaveBeenCalledWith({
        to: "party@example.com",
        evento: "invitacion_enviada",
      });
    });

    it("dispatches via the push provider for canal 'push', skipping email lookup", async () => {
      const findRecipientEmail = jest.fn();
      const pushProvider: PushProvider = {
        send: jest.fn().mockResolvedValue(undefined),
      };
      const { service } = buildService({ findRecipientEmail, pushProvider });

      await service.deliver({ ...input, canal: "push", evento: "vencimiento" });

      expect(findRecipientEmail).not.toHaveBeenCalled();
      expect(pushProvider.send).toHaveBeenCalledWith({
        usuarioId: "user-1",
        evento: "vencimiento",
      });
    });
  });
});
