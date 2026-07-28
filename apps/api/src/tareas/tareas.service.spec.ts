import { HttpException, HttpStatus } from "@nestjs/common";
import { TareasService } from "./tareas.service";

const tarea = {
  id: "tarea-1",
  acuerdo_id: "acuerdo-1",
  caso_id: "caso-1",
  tipo: "tarea",
  descripcion: "Buscar al hijo en el colegio",
  fecha_evento: null,
  estado: "pendiente",
  created_at: "2026-07-28T10:00:00.000Z",
  updated_at: "2026-07-28T10:00:00.000Z",
};

function createDeps() {
  const membershipService = {
    assertMembership: jest.fn().mockResolvedValue({}),
  };
  const tareasRepository = {
    listByCaso: jest.fn().mockResolvedValue([tarea]),
    findById: jest.fn().mockResolvedValue(tarea),
    updateEstado: jest
      .fn()
      .mockResolvedValue({ ...tarea, estado: "completada" }),
    scheduleCalendarEvent: jest.fn().mockResolvedValue({
      ...tarea,
      tipo: "evento_calendario",
      fecha_evento: "2026-08-15T13:30:00.000Z",
    }),
    insertGenerated: jest.fn().mockResolvedValue([tarea]),
  };
  return { membershipService, tareasRepository };
}

function createService(deps = createDeps()) {
  return {
    ...deps,
    service: new TareasService(
      deps.membershipService as never,
      deps.tareasRepository as never,
    ),
  };
}

function caseNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

describe("TareasService", () => {
  describe("listForCaso", () => {
    it("gates on membership before reading the case tareas", async () => {
      const { service, membershipService, tareasRepository } = createService();

      const result = await service.listForCaso("caso-1", "user-a");

      expect(membershipService.assertMembership).toHaveBeenCalledWith(
        "caso-1",
        "user-a",
      );
      expect(tareasRepository.listByCaso).toHaveBeenCalledWith("caso-1");
      expect(result).toEqual([tarea]);
    });

    it("propagates the membership rejection without reading tareas", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(caseNotFound());
      const { service, tareasRepository } = createService(deps);

      await expect(
        service.listForCaso("caso-1", "outsider"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "caso_not_found" },
      });
      expect(tareasRepository.listByCaso).not.toHaveBeenCalled();
    });
  });

  describe("updateEstado", () => {
    it("writes a valid estado transition for a member", async () => {
      const { service, membershipService, tareasRepository } = createService();

      const result = await service.updateEstado("tarea-1", "user-a", {
        estado: "completada",
      });

      expect(membershipService.assertMembership).toHaveBeenCalledWith(
        "caso-1",
        "user-a",
      );
      expect(tareasRepository.updateEstado).toHaveBeenCalledWith(
        "tarea-1",
        "completada",
      );
      expect(result.estado).toBe("completada");
    });

    it("rejects an estado outside the enum", async () => {
      const { service, tareasRepository } = createService();

      await expect(
        service.updateEstado("tarea-1", "user-a", {
          estado: "archivada" as never,
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(tareasRepository.updateEstado).not.toHaveBeenCalled();
    });

    it("returns tarea_not_found for an unknown tarea", async () => {
      const deps = createDeps();
      deps.tareasRepository.findById.mockResolvedValue(undefined);
      const { service } = createService(deps);

      await expect(
        service.updateEstado("missing", "user-a", { estado: "completada" }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "tarea_not_found" },
      });
    });

    it("hides a tarea belonging to another case behind tarea_not_found", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(caseNotFound());
      const { service, tareasRepository } = createService(deps);

      await expect(
        service.updateEstado("tarea-1", "outsider", { estado: "completada" }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "tarea_not_found" },
      });
      expect(tareasRepository.updateEstado).not.toHaveBeenCalled();
    });

    it("does not swallow non-404 membership failures", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(
        new Error("connection lost"),
      );
      const { service } = createService(deps);

      await expect(
        service.updateEstado("tarea-1", "user-a", { estado: "completada" }),
      ).rejects.toThrow("connection lost");
    });
  });

  describe("addToCalendar", () => {
    it("schedules the accionable and returns the calendar payload", async () => {
      const { service, tareasRepository } = createService();

      const result = await service.addToCalendar("tarea-1", "user-a", {
        fecha_evento: "2026-08-15T13:30:00.000Z",
      });

      expect(tareasRepository.scheduleCalendarEvent).toHaveBeenCalledWith(
        "tarea-1",
        "2026-08-15T13:30:00.000Z",
      );
      expect(result.tarea.tipo).toBe("evento_calendario");
      expect(result.ics).toContain("BEGIN:VCALENDAR");
      expect(result.ics).toContain("DTSTART:20260815T133000Z");
      expect(result.ics).toContain("SUMMARY:Buscar al hijo en el colegio");
    });

    it("falls back to the fecha_evento already stored on the tarea", async () => {
      const deps = createDeps();
      deps.tareasRepository.findById.mockResolvedValue({
        ...tarea,
        fecha_evento: "2026-09-01T08:00:00.000Z",
      });
      const { service, tareasRepository } = createService(deps);

      await service.addToCalendar("tarea-1", "user-a", {});

      expect(tareasRepository.scheduleCalendarEvent).toHaveBeenCalledWith(
        "tarea-1",
        "2026-09-01T08:00:00.000Z",
      );
    });

    it("accepts the Date object the pg driver returns for the stored TIMESTAMPTZ", async () => {
      const deps = createDeps();
      deps.tareasRepository.findById.mockResolvedValue({
        ...tarea,
        fecha_evento: new Date("2026-09-01T08:00:00.000Z"),
      });
      const { service, tareasRepository } = createService(deps);

      await service.addToCalendar("tarea-1", "user-a", {});

      expect(tareasRepository.scheduleCalendarEvent).toHaveBeenCalledWith(
        "tarea-1",
        "2026-09-01T08:00:00.000Z",
      );
    });

    it("rejects when neither the body nor the tarea carries a date", async () => {
      const { service, tareasRepository } = createService();

      await expect(
        service.addToCalendar("tarea-1", "user-a", {}),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(tareasRepository.scheduleCalendarEvent).not.toHaveBeenCalled();
    });

    it("rejects a fecha_evento that is not a valid ISO date", async () => {
      const { service } = createService();

      await expect(
        service.addToCalendar("tarea-1", "user-a", {
          fecha_evento: "manana",
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
    });

    it("hides a tarea from another case behind tarea_not_found", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(caseNotFound());
      const { service } = createService(deps);

      await expect(
        service.addToCalendar("tarea-1", "outsider", {
          fecha_evento: "2026-08-15T13:30:00.000Z",
        }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "tarea_not_found" },
      });
    });
  });

  describe("generateForAcuerdo", () => {
    it("derives the accionables from the agreement content and persists them", async () => {
      const { service, tareasRepository } = createService();

      const result = await service.generateForAcuerdo("acuerdo-1", "caso-1", {
        contenido: {
          meetingPoint: [{ categoria: "bienes", punto: 500 }],
          narrative: null,
        },
      });

      expect(tareasRepository.insertGenerated).toHaveBeenCalledWith(
        "acuerdo-1",
        [
          {
            acuerdo_id: "acuerdo-1",
            caso_id: "caso-1",
            tipo: "tarea",
            descripcion: "Bienes — punto acordado: 500",
          },
        ],
      );
      expect(result).toEqual([tarea]);
    });

    it("persists nothing when the agreement yields no accionables", async () => {
      const { service, tareasRepository } = createService();

      await service.generateForAcuerdo("acuerdo-1", "caso-1", {});

      expect(tareasRepository.insertGenerated).toHaveBeenCalledWith(
        "acuerdo-1",
        [],
      );
    });
  });
});
