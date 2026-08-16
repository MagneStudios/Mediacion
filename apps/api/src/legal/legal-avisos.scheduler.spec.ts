import { Logger } from "@nestjs/common";
import type { AppConfig } from "../config/config";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import type { LegalRepository } from "./legal.repository";
import { LegalAvisosScheduler } from "./legal-avisos.scheduler";

describe("LegalAvisosScheduler", () => {
  const now = new Date("2026-08-15T00:00:00.000Z");

  const publicacion = {
    tipo: "terms",
    version: "v2.0",
    valid_from: "2026-08-25T00:00:00.000Z",
    resumen_cambios: "Cambia el plazo de baja",
  };

  const usuarios = [
    { id: "user-1", email: "ana@example.com" },
    { id: "user-2", email: "beto@example.com" },
  ];

  function buildScheduler(options?: {
    findPublicacionesProgramadas?: jest.Mock;
    findUsuariosActivos?: jest.Mock;
    claimAviso?: jest.Mock;
    findAvisoPendiente?: jest.Mock;
    markAvisoEnviado?: jest.Mock;
    send?: jest.Mock;
  }) {
    const legalRepository = {
      findPublicacionesProgramadas:
        options?.findPublicacionesProgramadas ??
        jest.fn().mockResolvedValue([publicacion]),
      findUsuariosActivos:
        options?.findUsuariosActivos ?? jest.fn().mockResolvedValue(usuarios),
      claimAviso:
        options?.claimAviso ?? jest.fn().mockResolvedValue({ id: "aviso-1" }),
      findAvisoPendiente:
        options?.findAvisoPendiente ?? jest.fn().mockResolvedValue(undefined),
      markAvisoEnviado:
        options?.markAvisoEnviado ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as LegalRepository;
    const emailProvider = {
      send: options?.send ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as EmailProvider;
    const appConfig = { legalAvisoDiasAnticipacion: 10 } as AppConfig;
    return {
      scheduler: new LegalAvisosScheduler(
        legalRepository,
        emailProvider,
        appConfig,
      ),
      legalRepository,
      emailProvider,
    };
  }

  it("looks only at publications inside the notice window", async () => {
    const findPublicacionesProgramadas = jest.fn().mockResolvedValue([]);
    const findUsuariosActivos = jest.fn();
    const { scheduler } = buildScheduler({
      findPublicacionesProgramadas,
      findUsuariosActivos,
    });

    await scheduler.runSweep(now);

    expect(findPublicacionesProgramadas).toHaveBeenCalledWith(
      "2026-08-15T00:00:00.000Z",
      "2026-08-25T00:00:00.000Z",
    );
    expect(findUsuariosActivos).not.toHaveBeenCalled();
  });

  it("notifies every active user once and marks the notice as delivered", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const markAvisoEnviado = jest.fn().mockResolvedValue(undefined);
    const { scheduler } = buildScheduler({ send, markAvisoEnviado });

    await scheduler.runSweep(now);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@example.com" }),
    );
    expect(markAvisoEnviado).toHaveBeenCalledTimes(2);
  });

  it("sends nothing on a second sweep over the same publication", async () => {
    const send = jest.fn();
    const { scheduler } = buildScheduler({
      claimAviso: jest.fn().mockResolvedValue(undefined),
      findAvisoPendiente: jest.fn().mockResolvedValue(undefined),
      send,
    });

    await scheduler.runSweep(now);

    expect(send).not.toHaveBeenCalled();
  });

  it("retries a claimed notice whose email never went out", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const { scheduler } = buildScheduler({
      claimAviso: jest.fn().mockResolvedValue(undefined),
      findAvisoPendiente: jest.fn().mockResolvedValue({ id: "aviso-9" }),
      send,
    });

    await scheduler.runSweep(now);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps going when one recipient fails", async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValueOnce(undefined);
    const { scheduler } = buildScheduler({ send });

    await expect(scheduler.runSweep(now)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("logs the breach when the notice period is shorter than the minimum", async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const { scheduler } = buildScheduler({
      findPublicacionesProgramadas: jest
        .fn()
        .mockResolvedValue([
          { ...publicacion, valid_from: "2026-08-17T00:00:00.000Z" },
        ]),
    });

    await scheduler.runSweep(now);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("below the 10 day minimum"),
    );
    errorSpy.mockRestore();
  });

  it("does not report a breach when the notice period is respected", async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const { scheduler } = buildScheduler();

    await scheduler.runSweep(now);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("never lets a sweep failure escape the cron entry point", async () => {
    const { scheduler } = buildScheduler({
      findPublicacionesProgramadas: jest
        .fn()
        .mockRejectedValue(new Error("db down")),
    });

    await expect(scheduler.sweep()).resolves.toBeUndefined();
  });
});
