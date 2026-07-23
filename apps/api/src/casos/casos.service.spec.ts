import { HttpException } from "@nestjs/common";
import type { CasosRepository } from "./casos.repository";
import { CasosService } from "./casos.service";
import type { CreateCasoDto } from "./casos.types";
import { estadoInvitacionAceptada } from "./casos.types";
import type { MembershipService } from "./membership.service";

describe("CasosService", () => {
  function buildService(overrides?: {
    createCaseWithParteA?: jest.Mock;
    findOwnCases?: jest.Mock;
    findDetailForMember?: jest.Mock;
    assertMembership?: jest.Mock;
  }) {
    const casosRepository = {
      createCaseWithParteA: overrides?.createCaseWithParteA ?? jest.fn(),
      findOwnCases: overrides?.findOwnCases ?? jest.fn(),
      findDetailForMember: overrides?.findDetailForMember ?? jest.fn(),
    } as unknown as CasosRepository;
    const membershipService = {
      assertMembership: overrides?.assertMembership ?? jest.fn(),
    } as unknown as MembershipService;
    return {
      service: new CasosService(casosRepository, membershipService),
      casosRepository,
      membershipService,
    };
  }

  describe("createCase", () => {
    it("creates the case and returns only id and estado", async () => {
      const createCaseWithParteA = jest.fn().mockResolvedValue({
        id: "caso-1",
        creador_id: "user-1",
        nombre: "Divorcio",
        descripcion: null,
        metodo: "mediacion",
        estado: "nuevo",
        created_at: "now",
        updated_at: "now",
      });
      const { service } = buildService({ createCaseWithParteA });
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      const result = await service.createCase("user-1", dto);

      expect(createCaseWithParteA).toHaveBeenCalledWith(dto, "user-1");
      expect(result).toEqual({ id: "caso-1", estado: "nuevo" });
    });

    it("rejects an invalid metodo before touching the repository", async () => {
      const createCaseWithParteA = jest.fn();
      const { service } = buildService({ createCaseWithParteA });
      const dto = {
        nombre: "Divorcio",
        metodo: "invalido",
      } as unknown as CreateCasoDto;

      let thrown: unknown;
      try {
        await service.createCase("user-1", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(createCaseWithParteA).not.toHaveBeenCalled();
    });

    it("rejects an empty nombre before touching the repository", async () => {
      const createCaseWithParteA = jest.fn();
      const { service } = buildService({ createCaseWithParteA });
      const dto: CreateCasoDto = { nombre: "  ", metodo: "mediacion" };

      let thrown: unknown;
      try {
        await service.createCase("user-1", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(createCaseWithParteA).not.toHaveBeenCalled();
    });
  });

  describe("listOwnCases", () => {
    it("delegates to the repository using the caller's id", async () => {
      const rows = [{ id: "caso-1" }];
      const findOwnCases = jest.fn().mockResolvedValue(rows);
      const { service } = buildService({ findOwnCases });

      const result = await service.listOwnCases("user-1");

      expect(findOwnCases).toHaveBeenCalledWith("user-1");
      expect(result).toBe(rows);
    });
  });

  describe("getCaseDetail", () => {
    it("asserts membership before reading the detail", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-1",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const detail = { id: "caso-1", nombre: "Divorcio" };
      const findDetailForMember = jest.fn().mockResolvedValue(detail);
      const { service } = buildService({
        assertMembership,
        findDetailForMember,
      });

      const result = await service.getCaseDetail("caso-1", "user-1");

      expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-1");
      expect(findDetailForMember).toHaveBeenCalledWith("caso-1", "user-1");
      expect(result).toBe(detail);
    });

    it("propagates the 404 thrown by the membership guard for non-members", async () => {
      const notFound = new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        404,
      );
      const assertMembership = jest.fn().mockRejectedValue(notFound);
      const findDetailForMember = jest.fn();
      const { service } = buildService({
        assertMembership,
        findDetailForMember,
      });

      let thrown: unknown;
      try {
        await service.getCaseDetail("caso-1", "stranger");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(findDetailForMember).not.toHaveBeenCalled();
    });

    it("returns 404 when the detail query itself finds no row", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-1",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const findDetailForMember = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({
        assertMembership,
        findDetailForMember,
      });

      let thrown: unknown;
      try {
        await service.getCaseDetail("caso-1", "user-1");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
    });
  });
});
