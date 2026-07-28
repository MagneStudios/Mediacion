import { IncumplimientosController } from "./incumplimientos.controller";

const caller = { id: "user-a" } as never;

describe("IncumplimientosController", () => {
  function createController() {
    const incumplimientosService = {
      registerBreach: jest.fn().mockResolvedValue({ id: "incumplimiento-1" }),
      listForAcuerdo: jest.fn().mockResolvedValue([]),
    };
    return {
      incumplimientosService,
      controller: new IncumplimientosController(
        incumplimientosService as never,
      ),
    };
  }

  it("delegates the breach registration with the caller id and body", async () => {
    const { controller, incumplimientosService } = createController();

    await controller.registerBreach("acuerdo-1", caller, {
      descripcion: "No cumplió",
    });

    expect(incumplimientosService.registerBreach).toHaveBeenCalledWith(
      "acuerdo-1",
      "user-a",
      { descripcion: "No cumplió" },
    );
  });

  it("delegates the breach log read with the caller id", async () => {
    const { controller, incumplimientosService } = createController();

    await controller.listForAcuerdo("acuerdo-1", caller);

    expect(incumplimientosService.listForAcuerdo).toHaveBeenCalledWith(
      "acuerdo-1",
      "user-a",
    );
  });
});
