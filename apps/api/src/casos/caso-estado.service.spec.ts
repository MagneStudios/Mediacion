import { HttpException, HttpStatus } from "@nestjs/common";
import { CasosService } from "./casos.service";

function createDeps() {
  return {
    casosRepository: {
      updateEstado: jest
        .fn()
        .mockResolvedValue({ id: "caso-1", estado: "terminado" }),
    },
    membershipService: {
      assertMembership: jest.fn().mockResolvedValue({}),
    },
    planLimitService: { assertCanCreateCase: jest.fn() },
  };
}

function createService(deps = createDeps()) {
  return {
    ...deps,
    service: new CasosService(
      deps.casosRepository as never,
      deps.membershipService as never,
      deps.planLimitService as never,
    ),
  };
}

describe("CasosService.setEstado", () => {
  it("declares the autonomous end of the negotiation for a member", async () => {
    const { service, membershipService, casosRepository } = createService();

    const result = await service.setEstado("caso-1", "user-a", {
      estado: "terminado",
    });

    expect(membershipService.assertMembership).toHaveBeenCalledWith(
      "caso-1",
      "user-a",
    );
    expect(casosRepository.updateEstado).toHaveBeenCalledWith(
      "caso-1",
      "terminado",
    );
    expect(result).toEqual({ id: "caso-1", estado: "terminado" });
  });

  it.each(["acordado", "cerrado", "activo", "vencido", undefined, ""])(
    "rejects %p — only terminado is caller-driven",
    async (estado) => {
      const { service, casosRepository, membershipService } = createService();

      await expect(
        service.setEstado("caso-1", "user-a", { estado: estado as never }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(membershipService.assertMembership).not.toHaveBeenCalled();
      expect(casosRepository.updateEstado).not.toHaveBeenCalled();
    },
  );

  it("propagates the membership rejection without touching the case", async () => {
    const deps = createDeps();
    deps.membershipService.assertMembership.mockRejectedValue(
      new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        HttpStatus.NOT_FOUND,
      ),
    );
    const { service, casosRepository } = createService(deps);

    await expect(
      service.setEstado("caso-1", "outsider", { estado: "terminado" }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: "caso_not_found" },
    });
    expect(casosRepository.updateEstado).not.toHaveBeenCalled();
  });

  it("surfaces the database state-machine rejection as a conflict", async () => {
    const deps = createDeps();
    deps.casosRepository.updateEstado.mockRejectedValue(
      new HttpException(
        { code: "conflict", message: "Invalid transition" },
        HttpStatus.CONFLICT,
      ),
    );
    const { service } = createService(deps);

    await expect(
      service.setEstado("caso-1", "user-a", { estado: "terminado" }),
    ).rejects.toMatchObject({ status: 409, response: { code: "conflict" } });
  });
});

describe("CasosService.listCategorias", () => {
  it("returns the predefined base categories to a member", async () => {
    const { service, membershipService } = createService();

    const result = await service.listCategorias("caso-1", "user-a");

    expect(membershipService.assertMembership).toHaveBeenCalledWith(
      "caso-1",
      "user-a",
    );
    expect(result).toEqual([
      "cuidado_ninos",
      "cronogramas",
      "bienes",
      "economico",
      "personalizado",
    ]);
  });

  it("does not disclose the categories to a non-member", async () => {
    const deps = createDeps();
    deps.membershipService.assertMembership.mockRejectedValue(
      new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        HttpStatus.NOT_FOUND,
      ),
    );
    const { service } = createService(deps);

    await expect(
      service.listCategorias("caso-1", "outsider"),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: "caso_not_found" },
    });
  });
});
