import { TareasController } from "./tareas.controller";

const caller = { id: "user-a" } as never;

describe("TareasController", () => {
  function createController() {
    const tareasService = {
      listForCaso: jest.fn().mockResolvedValue([]),
      updateEstado: jest.fn().mockResolvedValue({ id: "tarea-1" }),
      addToCalendar: jest.fn().mockResolvedValue({ tarea: {}, ics: "" }),
    };
    return {
      tareasService,
      controller: new TareasController(tareasService as never),
    };
  }

  it("delegates the case listing with the caller id", async () => {
    const { controller, tareasService } = createController();

    await controller.listForCaso("caso-1", caller);

    expect(tareasService.listForCaso).toHaveBeenCalledWith("caso-1", "user-a");
  });

  it("delegates the estado update with the body", async () => {
    const { controller, tareasService } = createController();

    await controller.updateEstado("tarea-1", caller, { estado: "completada" });

    expect(tareasService.updateEstado).toHaveBeenCalledWith(
      "tarea-1",
      "user-a",
      { estado: "completada" },
    );
  });

  it("delegates the calendar promotion with the body", async () => {
    const { controller, tareasService } = createController();

    await controller.addToCalendar("tarea-1", caller, {
      fecha_evento: "2026-08-15T13:30:00.000Z",
    });

    expect(tareasService.addToCalendar).toHaveBeenCalledWith(
      "tarea-1",
      "user-a",
      { fecha_evento: "2026-08-15T13:30:00.000Z" },
    );
  });
});
