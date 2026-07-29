import { HttpException, HttpStatus } from "@nestjs/common";
import { IncumplimientosService } from "./incumplimientos.service";

const acuerdo = { id: "acuerdo-1", caso_id: "caso-1", estado: "firmado" };
const registered = {
  id: "incumplimiento-1",
  acuerdo_id: "acuerdo-1",
  reportante_id: "user-a",
  descripcion: "No cumplió el cronograma",
  fecha: "2026-07-28T10:00:00.000Z",
  created_at: "2026-07-28T10:00:00.000Z",
};

function createDeps() {
  return {
    membershipService: {
      assertMembership: jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-a",
        rol_en_caso: "parte_a",
        estado_invitacion: "aceptada",
      }),
    },
    incumplimientosRepository: {
      findAcuerdo: jest.fn().mockResolvedValue(acuerdo),
      registerBreach: jest.fn().mockResolvedValue(registered),
      listByAcuerdo: jest.fn().mockResolvedValue([registered]),
    },
  };
}

function createService(deps = createDeps()) {
  return {
    ...deps,
    service: new IncumplimientosService(
      deps.membershipService as never,
      deps.incumplimientosRepository as never,
    ),
  };
}

function caseNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

describe("IncumplimientosService", () => {
  describe("registerBreach", () => {
    it("records the breach for a party of a signed agreement", async () => {
      const { service, incumplimientosRepository } = createService();

      const result = await service.registerBreach("acuerdo-1", "user-a", {
        descripcion: "  No cumplió el cronograma  ",
      });

      expect(incumplimientosRepository.registerBreach).toHaveBeenCalledWith(
        "acuerdo-1",
        "user-a",
        "No cumplió el cronograma",
      );
      expect(result).toBe(registered);
    });

    it("allows a second breach notice on an agreement already con_aviso", async () => {
      const deps = createDeps();
      deps.incumplimientosRepository.findAcuerdo.mockResolvedValue({
        ...acuerdo,
        estado: "con_aviso",
      });
      const { service, incumplimientosRepository } = createService(deps);

      await service.registerBreach("acuerdo-1", "user-a", {
        descripcion: "Segundo aviso",
      });

      expect(incumplimientosRepository.registerBreach).toHaveBeenCalled();
    });

    it.each(["borrador", "enviado_a_firma"])(
      "rejects a breach on an agreement in %s",
      async (estado) => {
        const deps = createDeps();
        deps.incumplimientosRepository.findAcuerdo.mockResolvedValue({
          ...acuerdo,
          estado,
        });
        const { service, incumplimientosRepository } = createService(deps);

        await expect(
          service.registerBreach("acuerdo-1", "user-a", {
            descripcion: "Aviso prematuro",
          }),
        ).rejects.toMatchObject({
          status: 422,
          response: { code: "acuerdo_not_firmado" },
        });
        expect(incumplimientosRepository.registerBreach).not.toHaveBeenCalled();
      },
    );

    it("rejects a mediador — only parties may report a breach", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockResolvedValue({
        id: "parte-3",
        caso_id: "caso-1",
        usuario_id: "mediador-1",
        rol_en_caso: "mediador",
        estado_invitacion: "aceptada",
      });
      const { service, incumplimientosRepository } = createService(deps);

      await expect(
        service.registerBreach("acuerdo-1", "mediador-1", {
          descripcion: "Aviso del mediador",
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: "forbidden_role" },
      });
      expect(incumplimientosRepository.registerBreach).not.toHaveBeenCalled();
    });

    it.each([undefined, "", "   ", 42])(
      "rejects an empty descripcion (%p)",
      async (descripcion) => {
        const { service } = createService();

        await expect(
          service.registerBreach("acuerdo-1", "user-a", {
            descripcion: descripcion as never,
          }),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: "invalid_input" },
        });
      },
    );

    it("returns acuerdo_not_found for an unknown agreement", async () => {
      const deps = createDeps();
      deps.incumplimientosRepository.findAcuerdo.mockResolvedValue(undefined);
      const { service } = createService(deps);

      await expect(
        service.registerBreach("missing", "user-a", { descripcion: "Aviso" }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "acuerdo_not_found" },
      });
    });

    it("hides another case's agreement behind acuerdo_not_found", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(caseNotFound());
      const { service } = createService(deps);

      await expect(
        service.registerBreach("acuerdo-1", "outsider", {
          descripcion: "Aviso",
        }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "acuerdo_not_found" },
      });
    });

    it("does not swallow non-404 membership failures", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(
        new Error("connection lost"),
      );
      const { service } = createService(deps);

      await expect(
        service.registerBreach("acuerdo-1", "user-a", { descripcion: "Aviso" }),
      ).rejects.toThrow("connection lost");
    });
  });

  describe("listForAcuerdo", () => {
    it("returns the breach log for a member", async () => {
      const { service, incumplimientosRepository } = createService();

      const result = await service.listForAcuerdo("acuerdo-1", "user-a");

      expect(incumplimientosRepository.listByAcuerdo).toHaveBeenCalledWith(
        "acuerdo-1",
      );
      expect(result).toEqual([registered]);
    });

    it("lets a mediador read the breach log", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockResolvedValue({
        id: "parte-3",
        caso_id: "caso-1",
        usuario_id: "mediador-1",
        rol_en_caso: "mediador",
        estado_invitacion: "aceptada",
      });
      const { service, incumplimientosRepository } = createService(deps);

      await service.listForAcuerdo("acuerdo-1", "mediador-1");

      expect(incumplimientosRepository.listByAcuerdo).toHaveBeenCalled();
    });

    it("hides another case's breach log behind acuerdo_not_found", async () => {
      const deps = createDeps();
      deps.membershipService.assertMembership.mockRejectedValue(caseNotFound());
      const { service, incumplimientosRepository } = createService(deps);

      await expect(
        service.listForAcuerdo("acuerdo-1", "outsider"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "acuerdo_not_found" },
      });
      expect(incumplimientosRepository.listByAcuerdo).not.toHaveBeenCalled();
    });
  });
});
