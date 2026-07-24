import { HttpException } from "@nestjs/common";
import type { CasosRepository } from "../casos/casos.repository";
import type { MembershipService } from "../casos/membership.service";
import type { AcuerdosRepository } from "./acuerdos.repository";
import { AcuerdosService } from "./acuerdos.service";

function createFakeKyselyWithPropuesta(
  propuesta: unknown,
  respuestas: unknown[],
) {
  const propuestaExecuteTakeFirst = jest.fn().mockResolvedValue(propuesta);
  const propuestaOrderBy2 = jest
    .fn()
    .mockReturnValue({ executeTakeFirst: propuestaExecuteTakeFirst });
  const propuestaOrderBy1 = jest
    .fn()
    .mockReturnValue({ orderBy: propuestaOrderBy2 });
  const propuestaWhere2 = jest
    .fn()
    .mockReturnValue({ orderBy: propuestaOrderBy1 });
  const propuestaWhere1 = jest.fn().mockReturnValue({ where: propuestaWhere2 });
  const propuestaSelectAll = jest
    .fn()
    .mockReturnValue({ where: propuestaWhere1 });

  const respuestasExecute = jest.fn().mockResolvedValue(respuestas);
  const respuestasWhere = jest
    .fn()
    .mockReturnValue({ execute: respuestasExecute });
  const respuestasSelectAll = jest
    .fn()
    .mockReturnValue({ where: respuestasWhere });

  const selectFrom = jest.fn((table: string) => {
    if (table === "propuestas") {
      return { selectAll: propuestaSelectAll };
    }
    if (table === "respuestas_propuesta") {
      return { selectAll: respuestasSelectAll };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { selectFrom };
}

describe("AcuerdosService", () => {
  function buildService(overrides?: {
    assertMembership?: jest.Mock;
    findDetailForMember?: jest.Mock;
    insertDraft?: jest.Mock;
    kysely?: unknown;
  }) {
    const membershipService = {
      assertMembership:
        overrides?.assertMembership ?? jest.fn().mockResolvedValue({}),
    } as unknown as MembershipService;
    const casosRepository = {
      findDetailForMember: overrides?.findDetailForMember ?? jest.fn(),
    } as unknown as CasosRepository;
    const acuerdosRepository = {
      insertDraft: overrides?.insertDraft ?? jest.fn(),
    } as unknown as AcuerdosRepository;
    const kysely = overrides?.kysely ?? {};
    return {
      service: new AcuerdosService(
        membershipService,
        casosRepository,
        acuerdosRepository,
        kysely as never,
      ),
    };
  }

  describe("generateAgreement", () => {
    it("blocks non-members with 404 before reading the case", async () => {
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
        await service.generateAgreement("caso-1", "stranger");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(findDetailForMember).not.toHaveBeenCalled();
    });

    it("rejects with 422 when the caso is not in acordado state", async () => {
      const findDetailForMember = jest
        .fn()
        .mockResolvedValue({ id: "caso-1", estado: "en_negociacion" });
      const insertDraft = jest.fn();
      const { service } = buildService({ findDetailForMember, insertDraft });

      let thrown: unknown;
      try {
        await service.generateAgreement("caso-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(422);
      expect(insertDraft).not.toHaveBeenCalled();
    });

    it("generates a draft agreement from the accepted propuesta when the caso is acordado", async () => {
      const findDetailForMember = jest
        .fn()
        .mockResolvedValue({ id: "caso-1", estado: "acordado" });
      const propuesta = {
        id: "propuesta-1",
        contenido: { split: "50/50" },
        fundamentacion: null,
        modelo_ia: null,
      };
      const respuestas = [
        { parte_id: "user-a", decision: "acepta", fecha: "now" },
      ];
      const kysely = createFakeKyselyWithPropuesta(propuesta, respuestas);
      const insertedAcuerdo = {
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      };
      const insertDraft = jest.fn().mockResolvedValue(insertedAcuerdo);
      const { service } = buildService({
        findDetailForMember,
        insertDraft,
        kysely,
      });

      const result = await service.generateAgreement("caso-1", "user-a");

      expect(insertDraft).toHaveBeenCalledWith(
        "caso-1",
        expect.objectContaining({ propuesta_id: "propuesta-1" }),
      );
      expect(result).toBe(insertedAcuerdo);
    });

    it("rejects with 422 when no accepted propuesta exists for the caso", async () => {
      const findDetailForMember = jest
        .fn()
        .mockResolvedValue({ id: "caso-1", estado: "acordado" });
      const kysely = createFakeKyselyWithPropuesta(undefined, []);
      const insertDraft = jest.fn();
      const { service } = buildService({
        findDetailForMember,
        insertDraft,
        kysely,
      });

      let thrown: unknown;
      try {
        await service.generateAgreement("caso-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(422);
      expect(insertDraft).not.toHaveBeenCalled();
    });

    it("propagates the 409 thrown by the repository when a draft already exists for the caso", async () => {
      const findDetailForMember = jest
        .fn()
        .mockResolvedValue({ id: "caso-1", estado: "acordado" });
      const propuesta = {
        id: "propuesta-1",
        contenido: {},
        fundamentacion: null,
        modelo_ia: null,
      };
      const kysely = createFakeKyselyWithPropuesta(propuesta, []);
      const conflict = new HttpException(
        { code: "acuerdo_already_exists", message: "Conflict" },
        409,
      );
      const insertDraft = jest.fn().mockRejectedValue(conflict);
      const { service } = buildService({
        findDetailForMember,
        insertDraft,
        kysely,
      });

      let thrown: unknown;
      try {
        await service.generateAgreement("caso-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(conflict);
    });
  });
});
