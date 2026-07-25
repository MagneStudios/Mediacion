import type { CasosRepository } from "../casos/casos.repository";
import type { NotificacionesRepository } from "./notificaciones.repository";
import type { NotificacionesService } from "./notificaciones.service";
import { VencimientoScheduler } from "./vencimiento.scheduler";

describe("VencimientoScheduler", () => {
  function buildScheduler(overrides?: {
    findOverdueCasos?: jest.Mock;
    findEventoEstado?: jest.Mock;
    findAceptadaParties?: jest.Mock;
    emitAwaited?: jest.Mock;
    redeliverAwaited?: jest.Mock;
  }) {
    const casosRepository = {
      findOverdueCasos: overrides?.findOverdueCasos ?? jest.fn(),
    } as unknown as CasosRepository;
    const notificacionesRepository = {
      findEventoEstado: overrides?.findEventoEstado ?? jest.fn(),
      findAceptadaParties: overrides?.findAceptadaParties ?? jest.fn(),
    } as unknown as NotificacionesRepository;
    const notificacionesService = {
      emitAwaited:
        overrides?.emitAwaited ?? jest.fn().mockResolvedValue(undefined),
      redeliverAwaited:
        overrides?.redeliverAwaited ?? jest.fn().mockResolvedValue(undefined),
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
    it("calls emitAwaited once per accepted party of an overdue caso with no recorded vencimiento notification", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const findEventoEstado = jest.fn().mockResolvedValue(undefined);
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const emitAwaited = jest.fn().mockResolvedValue(undefined);
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
      });
      const now = new Date("2026-07-24T12:00:00.000Z");

      await scheduler.runSweep(now);

      expect(findOverdueCasos).toHaveBeenCalledWith(now);
      expect(findAceptadaParties).toHaveBeenCalledWith("caso-1");
      expect(findEventoEstado).toHaveBeenCalledWith(
        "caso-1",
        "vencimiento",
        "user-a",
      );
      expect(findEventoEstado).toHaveBeenCalledWith(
        "caso-1",
        "vencimiento",
        "user-b",
      );
      expect(emitAwaited).toHaveBeenCalledTimes(2);
      expect(emitAwaited).toHaveBeenCalledWith({
        usuarioId: "user-a",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
      expect(emitAwaited).toHaveBeenCalledWith({
        usuarioId: "user-b",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
    });

    it("skips a party whose vencimiento notification already settled as enviada", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const findEventoEstado = jest
        .fn()
        .mockResolvedValue({ id: "notif-1", estado: "enviada" });
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([{ usuario_id: "user-a" }]);
      const emitAwaited = jest.fn().mockResolvedValue(undefined);
      const redeliverAwaited = jest.fn().mockResolvedValue(undefined);
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
        redeliverAwaited,
      });

      await scheduler.runSweep(new Date("2026-07-24T12:00:00.000Z"));

      expect(emitAwaited).not.toHaveBeenCalled();
      expect(redeliverAwaited).not.toHaveBeenCalled();
    });

    it("skips a party whose vencimiento notification already settled as fallida", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const findEventoEstado = jest
        .fn()
        .mockResolvedValue({ id: "notif-1", estado: "fallida" });
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([{ usuario_id: "user-a" }]);
      const emitAwaited = jest.fn().mockResolvedValue(undefined);
      const redeliverAwaited = jest.fn().mockResolvedValue(undefined);
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
        redeliverAwaited,
      });

      await scheduler.runSweep(new Date("2026-07-24T12:00:00.000Z"));

      expect(emitAwaited).not.toHaveBeenCalled();
      expect(redeliverAwaited).not.toHaveBeenCalled();
    });

    it("redelivers via the existing row when a party's notification was left pendiente by a mid-sweep crash", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const findEventoEstado = jest
        .fn()
        .mockResolvedValue({ id: "notif-1", estado: "pendiente" });
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([{ usuario_id: "user-a" }]);
      const emitAwaited = jest.fn().mockResolvedValue(undefined);
      const redeliverAwaited = jest.fn().mockResolvedValue(undefined);
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
        redeliverAwaited,
      });

      await scheduler.runSweep(new Date("2026-07-24T12:00:00.000Z"));

      expect(emitAwaited).not.toHaveBeenCalled();
      expect(redeliverAwaited).toHaveBeenCalledWith("notif-1", {
        usuarioId: "user-a",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
    });

    it("resolves deliveries for the parties of a caso concurrently rather than sequentially", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const findEventoEstado = jest.fn().mockResolvedValue(undefined);
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const deliveries: Array<{ resolve: () => void }> = [];
      const emitAwaited = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            deliveries.push({ resolve });
          }),
      );
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
      });

      let settled = false;
      const runSweepResult = scheduler
        .runSweep(new Date("2026-07-24T12:00:00.000Z"))
        .then(() => {
          settled = true;
        });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(deliveries).toHaveLength(2);

      deliveries[0].resolve();
      deliveries[1].resolve();
      await runSweepResult;

      expect(settled).toBe(true);
    });

    it("logs the failing party's context and still delivers the other party when findEventoEstado rejects", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const rejectionReason = new Error("connection lost");
      const findEventoEstado = jest
        .fn()
        .mockImplementation(
          (_casoId: string, _evento: string, usuarioId: string) =>
            usuarioId === "user-a"
              ? Promise.reject(rejectionReason)
              : Promise.resolve(undefined),
        );
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const emitAwaited = jest.fn().mockResolvedValue(undefined);
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
      });
      const loggerErrorSpy = jest.spyOn(
        (scheduler as unknown as { logger: { error: jest.Mock } }).logger,
        "error",
      );

      await expect(
        scheduler.runSweep(new Date("2026-07-24T12:00:00.000Z")),
      ).resolves.toBeUndefined();

      expect(emitAwaited).toHaveBeenCalledTimes(1);
      expect(emitAwaited).toHaveBeenCalledWith({
        usuarioId: "user-b",
        casoId: "caso-1",
        canal: "email",
        evento: "vencimiento",
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("caso-1"),
        rejectionReason,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("user-a"),
        rejectionReason,
      );
    });

    it("does nothing when there are no overdue casos", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([]);
      const findEventoEstado = jest.fn();
      const emitAwaited = jest.fn().mockResolvedValue(undefined);
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        emitAwaited,
      });

      await scheduler.runSweep(new Date());

      expect(findEventoEstado).not.toHaveBeenCalled();
      expect(emitAwaited).not.toHaveBeenCalled();
    });

    it("does not resolve until every party's delivery has settled", async () => {
      const findOverdueCasos = jest.fn().mockResolvedValue([{ id: "caso-1" }]);
      const findEventoEstado = jest.fn().mockResolvedValue(undefined);
      const findAceptadaParties = jest
        .fn()
        .mockResolvedValue([
          { usuario_id: "user-a" },
          { usuario_id: "user-b" },
        ]);
      const deliveries: Array<{ resolve: () => void }> = [];
      const emitAwaited = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            deliveries.push({ resolve });
          }),
      );
      const { scheduler } = buildScheduler({
        findOverdueCasos,
        findEventoEstado,
        findAceptadaParties,
        emitAwaited,
      });

      let settled = false;
      const runSweepResult = scheduler
        .runSweep(new Date("2026-07-24T12:00:00.000Z"))
        .then(() => {
          settled = true;
        });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(deliveries).toHaveLength(2);

      deliveries[0].resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      deliveries[1].resolve();
      await runSweepResult;

      expect(settled).toBe(true);
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
