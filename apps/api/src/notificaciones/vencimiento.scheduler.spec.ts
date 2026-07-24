import type { CasosRepository } from "../casos/casos.repository";
import type { NotificacionesRepository } from "./notificaciones.repository";
import type { NotificacionesService } from "./notificaciones.service";
import { VencimientoScheduler } from "./vencimiento.scheduler";

describe("VencimientoScheduler", () => {
  function buildScheduler(overrides?: {
    findOverdueCasos?: jest.Mock;
    existsEvento?: jest.Mock;
    findAceptadaParties?: jest.Mock;
    emit?: jest.Mock;
  }) {
    const casosRepository = {
      findOverdueCasos: overrides?.findOverdueCasos ?? jest.fn(),
    } as unknown as CasosRepository;
    const notificacionesRepository = {
      existsEvento: overrides?.existsEvento ?? jest.fn(),
      findAceptadaParties: overrides?.findAceptadaParties ?? jest.fn(),
    } as unknown as NotificacionesRepository;
    const notificacionesService = {
      emit: overrides?.emit ?? jest.fn(),
    } as unknown as NotificacionesService;
    return {
      scheduler: new VencimientoScheduler(
        casosRepository,
        notificacionesRepository,
        notificacionesService,
      ),
      casosRepository,
      notificacionesRepository,
      notificacionesService,
    };
  }

  describe("runSweep", () => {
    it("calls emit once per accepted party of an overdue caso with no prior vencimiento notification", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const existsEvento = jest.fn().mockResolvedValue(false);
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const emit = jest.fn();
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        existsEvento,
        findAceptadaParties,
        emit,
      });
      const now = new Date("2026-07-24T12:00:00.000Z");

      await scheduler.runSweep(now);

      expect(findOverdueCasos).toHaveBeenCalledWith(now);
      expect(findAceptadaParties).toHaveBeenCalledWith("caso-1");
      expect(existsEvento).toHaveBeenCalledWith(
        "caso-1",
        "vencimiento",
        "user-a",
      );
      expect(existsEvento).toHaveBeenCalledWith(
        "caso-1",
        "vencimiento",
        "user-b",
      );
      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledWith({
        usuarioId: "user-a",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
      expect(emit).toHaveBeenCalledWith({
        usuarioId: "user-b",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
    });

    it("skips a caso whose every accepted party already has a recorded vencimiento notification", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const existsEvento = jest.fn().mockResolvedValue(true);
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const emit = jest.fn();
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        existsEvento,
        findAceptadaParties,
        emit,
      });
      const now = new Date("2026-07-24T12:00:00.000Z");

      await scheduler.runSweep(now);

      expect(existsEvento).toHaveBeenCalledWith(
        "caso-1",
        "vencimiento",
        "user-a",
      );
      expect(existsEvento).toHaveBeenCalledWith(
        "caso-1",
        "vencimiento",
        "user-b",
      );
      expect(emit).not.toHaveBeenCalled();
    });

    it("emits only for the party still missing a notification after a mid-sweep crash", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const existsEvento = jest.fn(
        async (_casoId: string, _evento: string, usuarioId: string) =>
          usuarioId === "user-a",
      );
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const emit = jest.fn();
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        existsEvento,
        findAceptadaParties,
        emit,
      });
      const now = new Date("2026-07-24T12:00:00.000Z");

      await scheduler.runSweep(now);

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith({
        usuarioId: "user-b",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
    });

    it("does nothing when there are no overdue casos", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([]);
      const existsEvento = jest.fn();
      const emit = jest.fn();
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        existsEvento,
        emit,
      });

      await scheduler.runSweep(new Date());

      expect(existsEvento).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("sweep", () => {
    it("delegates to runSweep with the current time", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([]);
      const { scheduler } = buildScheduler({ findOverdueCasos });

      await scheduler.sweep();

      expect(findOverdueCasos).toHaveBeenCalledWith(expect.any(Date));
    });

    it("logs and never throws when the sweep body rejects", async () => {
      const findOverdueCasos = jest
        .fn()
        .mockRejectedValue(new Error("connection lost"));
      const { scheduler } = buildScheduler({ findOverdueCasos });
      const loggerErrorSpy = jest.spyOn(
        (scheduler as unknown as { logger: { error: jest.Mock } }).logger,
        "error",
      );

      await expect(scheduler.sweep()).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("vencimiento.sweep failed"),
        expect.any(Error),
      );
    });
  });
});
