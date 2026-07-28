import { HttpException } from "@nestjs/common";
import type { CasosRepository } from "../casos/casos.repository";
import type { MembershipService } from "../casos/membership.service";
import type { AcuerdoAccessService } from "./acuerdo-access.service";
import type { AcuerdosRepository } from "./acuerdos.repository";
import { AcuerdosService } from "./acuerdos.service";
import type { DocusignClient } from "./docusign/docusign-client";
import type { FirmasRepository } from "./firmas.repository";

function createFakeKyselyWithFirmantes(rows: unknown[]) {
  const execute = jest.fn().mockResolvedValue(rows);
  const where2 = jest.fn().mockReturnValue({ execute });
  const where1 = jest.fn().mockReturnValue({ where: where2 });
  const select = jest.fn().mockReturnValue({ where: where1 });
  const innerJoin = jest.fn().mockReturnValue({ select });
  const selectFrom = jest.fn().mockReturnValue({ innerJoin });
  return { selectFrom };
}

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
    findById?: jest.Mock;
    claimForSignature?: jest.Mock;
    persistSignatureEnvelope?: jest.Mock;
    revertClaimToBorrador?: jest.Mock;
    kysely?: unknown;
    createEnvelope?: jest.Mock;
    findByCasoId?: jest.Mock;
    assertReadAccess?: jest.Mock;
    listByAcuerdo?: jest.Mock;
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
      findById: overrides?.findById ?? jest.fn(),
      claimForSignature:
        overrides?.claimForSignature ??
        jest.fn().mockResolvedValue({ id: "acuerdo-1" }),
      persistSignatureEnvelope:
        overrides?.persistSignatureEnvelope ?? jest.fn(),
      revertClaimToBorrador: overrides?.revertClaimToBorrador ?? jest.fn(),
      findByCasoId: overrides?.findByCasoId ?? jest.fn(),
    } as unknown as AcuerdosRepository;
    const kysely = overrides?.kysely ?? {};
    const docusignClient = {
      createEnvelope: overrides?.createEnvelope ?? jest.fn(),
    } as unknown as DocusignClient;
    const acuerdoAccessService = {
      assertReadAccess:
        overrides?.assertReadAccess ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as AcuerdoAccessService;
    const firmasRepository = {
      listByAcuerdo:
        overrides?.listByAcuerdo ?? jest.fn().mockResolvedValue([]),
    } as unknown as FirmasRepository;
    return {
      acuerdoAccessService,
      firmasRepository,
      service: new AcuerdosService(
        membershipService,
        casosRepository,
        acuerdosRepository,
        kysely as never,
        docusignClient,
        acuerdoAccessService,
        firmasRepository,
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

  describe("sendToSignature", () => {
    it("claims the acuerdo before creating the envelope, then persists the envelope id and firmas", async () => {
      const findById = jest.fn().mockResolvedValue({
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      });
      const firmantes = [
        {
          usuario_id: "user-a",
          email: "a@example.com",
          nombre: "Ana",
          apellido: "Perez",
        },
        {
          usuario_id: "user-b",
          email: "b@example.com",
          nombre: "Beto",
          apellido: "Diaz",
        },
      ];
      const kysely = createFakeKyselyWithFirmantes(firmantes);
      const claimForSignature = jest
        .fn()
        .mockResolvedValue({ id: "acuerdo-1", estado: "enviado_a_firma" });
      const createEnvelope = jest
        .fn()
        .mockResolvedValue({ envelopeId: "envelope-1" });
      const sentAcuerdo = {
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "enviado_a_firma",
        docusign_envelope_id: "envelope-1",
      };
      const persistSignatureEnvelope = jest.fn().mockResolvedValue(sentAcuerdo);
      const revertClaimToBorrador = jest.fn();
      const callOrder: string[] = [];
      claimForSignature.mockImplementation(async () => {
        callOrder.push("claim");
        return { id: "acuerdo-1", estado: "enviado_a_firma" };
      });
      createEnvelope.mockImplementation(async () => {
        callOrder.push("createEnvelope");
        return { envelopeId: "envelope-1" };
      });
      const { service } = buildService({
        findById,
        kysely,
        claimForSignature,
        createEnvelope,
        persistSignatureEnvelope,
        revertClaimToBorrador,
      });

      const result = await service.sendToSignature("acuerdo-1", "user-a");

      expect(callOrder).toEqual(["claim", "createEnvelope"]);
      expect(claimForSignature).toHaveBeenCalledWith("acuerdo-1");
      expect(createEnvelope).toHaveBeenCalledWith({
        acuerdoId: "acuerdo-1",
        signers: [
          { usuarioId: "user-a", email: "a@example.com", name: "Ana Perez" },
          { usuarioId: "user-b", email: "b@example.com", name: "Beto Diaz" },
        ],
      });
      expect(persistSignatureEnvelope).toHaveBeenCalledWith(
        "acuerdo-1",
        "envelope-1",
        ["user-a", "user-b"],
      );
      expect(revertClaimToBorrador).not.toHaveBeenCalled();
      expect(result).toBe(sentAcuerdo);
    });

    it("blocks with 404 when the acuerdo does not exist, without checking membership", async () => {
      const findById = jest.fn().mockResolvedValue(undefined);
      const assertMembership = jest.fn();
      const { service } = buildService({ findById, assertMembership });

      let thrown: unknown;
      try {
        await service.sendToSignature("acuerdo-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
      expect(assertMembership).not.toHaveBeenCalled();
    });

    it("blocks non-members with 404 before claiming the acuerdo", async () => {
      const findById = jest.fn().mockResolvedValue({
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      });
      const notFound = new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        404,
      );
      const assertMembership = jest.fn().mockRejectedValue(notFound);
      const claimForSignature = jest.fn();
      const createEnvelope = jest.fn();
      const { service } = buildService({
        findById,
        assertMembership,
        claimForSignature,
        createEnvelope,
      });

      let thrown: unknown;
      try {
        await service.sendToSignature("acuerdo-1", "stranger");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(claimForSignature).not.toHaveBeenCalled();
      expect(createEnvelope).not.toHaveBeenCalled();
    });

    it("never calls createEnvelope when a concurrent claim already won the race (409 CAS failure)", async () => {
      const findById = jest.fn().mockResolvedValue({
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      });
      const conflict = new HttpException(
        {
          code: "acuerdo_not_borrador",
          message: "Agreement is no longer in borrador state",
        },
        409,
      );
      const claimForSignature = jest.fn().mockRejectedValue(conflict);
      const createEnvelope = jest.fn();
      const { service } = buildService({
        findById,
        claimForSignature,
        createEnvelope,
      });

      let thrown: unknown;
      try {
        await service.sendToSignature("acuerdo-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(409);
      expect(createEnvelope).not.toHaveBeenCalled();
    });

    it("reverts the claim back to borrador and propagates the error when DocuSign envelope creation fails", async () => {
      const findById = jest.fn().mockResolvedValue({
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      });
      const firmantes = [
        {
          usuario_id: "user-a",
          email: "a@example.com",
          nombre: "Ana",
          apellido: "Perez",
        },
      ];
      const kysely = createFakeKyselyWithFirmantes(firmantes);
      const claimForSignature = jest
        .fn()
        .mockResolvedValue({ id: "acuerdo-1", estado: "enviado_a_firma" });
      const createEnvelope = jest
        .fn()
        .mockRejectedValue(
          new Error("DocuSign envelope creation failed with status 502"),
        );
      const persistSignatureEnvelope = jest.fn();
      const revertClaimToBorrador = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({
        findById,
        kysely,
        claimForSignature,
        createEnvelope,
        persistSignatureEnvelope,
        revertClaimToBorrador,
      });

      await expect(
        service.sendToSignature("acuerdo-1", "user-a"),
      ).rejects.toThrow("DocuSign envelope creation failed with status 502");
      expect(revertClaimToBorrador).toHaveBeenCalledWith("acuerdo-1");
      expect(persistSignatureEnvelope).not.toHaveBeenCalled();
    });

    it("reverts the claim, logs the orphaned envelope id and propagates the error when persisting the envelope fails", async () => {
      const findById = jest.fn().mockResolvedValue({
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      });
      const firmantes = [
        {
          usuario_id: "user-a",
          email: "a@example.com",
          nombre: "Ana",
          apellido: "Perez",
        },
      ];
      const kysely = createFakeKyselyWithFirmantes(firmantes);
      const claimForSignature = jest
        .fn()
        .mockResolvedValue({ id: "acuerdo-1", estado: "enviado_a_firma" });
      const createEnvelope = jest
        .fn()
        .mockResolvedValue({ envelopeId: "envelope-1" });
      const persistSignatureEnvelope = jest
        .fn()
        .mockRejectedValue(new Error("connection lost"));
      const revertClaimToBorrador = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({
        findById,
        kysely,
        claimForSignature,
        createEnvelope,
        persistSignatureEnvelope,
        revertClaimToBorrador,
      });
      const loggerErrorSpy = jest.spyOn(
        (service as unknown as { logger: { error: jest.Mock } }).logger,
        "error",
      );

      await expect(
        service.sendToSignature("acuerdo-1", "user-a"),
      ).rejects.toThrow("connection lost");

      expect(revertClaimToBorrador).toHaveBeenCalledWith("acuerdo-1");
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("envelope-1"),
        expect.any(Error),
      );
    });

    it("reverts the claim and propagates the error when the claim revert itself fails after envelope creation fails", async () => {
      const findById = jest.fn().mockResolvedValue({
        id: "acuerdo-1",
        caso_id: "caso-1",
        estado: "borrador",
      });
      const firmantes = [
        {
          usuario_id: "user-a",
          email: "a@example.com",
          nombre: "Ana",
          apellido: "Perez",
        },
      ];
      const kysely = createFakeKyselyWithFirmantes(firmantes);
      const claimForSignature = jest
        .fn()
        .mockResolvedValue({ id: "acuerdo-1", estado: "enviado_a_firma" });
      const createEnvelope = jest
        .fn()
        .mockRejectedValue(
          new Error("DocuSign envelope creation failed with status 502"),
        );
      const persistSignatureEnvelope = jest.fn();
      const revertClaimToBorrador = jest
        .fn()
        .mockRejectedValue(new Error("revert failed"));
      const { service } = buildService({
        findById,
        kysely,
        claimForSignature,
        createEnvelope,
        persistSignatureEnvelope,
        revertClaimToBorrador,
      });
      const loggerErrorSpy = jest.spyOn(
        (service as unknown as { logger: { error: jest.Mock } }).logger,
        "error",
      );

      await expect(
        service.sendToSignature("acuerdo-1", "user-a"),
      ).rejects.toThrow("DocuSign envelope creation failed with status 502");

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("revert claim failed"),
        expect.any(Error),
      );
    });
  });

  describe("getForCaso", () => {
    const acuerdo = {
      id: "acuerdo-1",
      caso_id: "caso-1",
      estado: "enviado_a_firma",
      contenido: {},
      documento_url: null,
      fecha: null,
    };

    it("returns the agreement with its signature statuses for an authorized reader", async () => {
      const listByAcuerdo = jest
        .fn()
        .mockResolvedValue([
          { id: "firma-1", usuario_id: "user-a", docusign_status: "signed" },
        ]);
      const { service, acuerdoAccessService } = buildService({
        findByCasoId: jest.fn().mockResolvedValue(acuerdo),
        listByAcuerdo,
      });

      const result = await service.getForCaso("caso-1", "user-a");

      expect(acuerdoAccessService.assertReadAccess).toHaveBeenCalledWith(
        "caso-1",
        "user-a",
      );
      expect(listByAcuerdo).toHaveBeenCalledWith("acuerdo-1");
      expect(result.acuerdo).toBe(acuerdo);
      expect(result.firmas).toHaveLength(1);
    });

    it("returns acuerdo_not_found when the case has no agreement yet", async () => {
      const { service } = buildService({
        findByCasoId: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        service.getForCaso("caso-1", "user-a"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "acuerdo_not_found" },
      });
    });

    it("propagates the access rejection without reading the agreement", async () => {
      const findByCasoId = jest.fn();
      const { service } = buildService({
        findByCasoId,
        assertReadAccess: jest
          .fn()
          .mockRejectedValue(
            new HttpException(
              { code: "caso_not_found", message: "Case not found" },
              404,
            ),
          ),
      });

      await expect(
        service.getForCaso("caso-1", "outsider"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "caso_not_found" },
      });
      expect(findByCasoId).not.toHaveBeenCalled();
    });
  });

  describe("exportAgreement", () => {
    const acuerdo = {
      id: "acuerdo-1",
      caso_id: "caso-1",
      estado: "firmado",
      fecha: "2026-07-28T10:00:00.000Z",
      documento_url: null,
      contenido: {
        contenido: { meetingPoint: [{ categoria: "bienes", punto: 100 }] },
      },
    };

    it("renders a named text document for an authorized reader", async () => {
      const { service, acuerdoAccessService } = buildService({
        findById: jest.fn().mockResolvedValue(acuerdo),
      });

      const result = await service.exportAgreement("acuerdo-1", "user-a");

      expect(acuerdoAccessService.assertReadAccess).toHaveBeenCalledWith(
        "caso-1",
        "user-a",
      );
      expect(result.filename).toBe("acuerdo-acuerdo-1.txt");
      expect(result.document).toContain("ACUERDO DE MEDIACIÓN");
      expect(result.document).toContain("- Bienes: 100");
    });

    it("returns acuerdo_not_found for an unknown agreement", async () => {
      const { service } = buildService({
        findById: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        service.exportAgreement("missing", "user-a"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "acuerdo_not_found" },
      });
    });

    it("hides an inaccessible agreement behind the same acuerdo_not_found as an unknown id", async () => {
      const { service } = buildService({
        findById: jest.fn().mockResolvedValue(acuerdo),
        assertReadAccess: jest
          .fn()
          .mockRejectedValue(
            new HttpException(
              { code: "caso_not_found", message: "Case not found" },
              404,
            ),
          ),
      });

      await expect(
        service.exportAgreement("acuerdo-1", "outsider"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "acuerdo_not_found" },
      });
    });

    it("does not swallow a non-404 access failure into acuerdo_not_found", async () => {
      const { service } = buildService({
        findById: jest.fn().mockResolvedValue(acuerdo),
        assertReadAccess: jest
          .fn()
          .mockRejectedValue(new Error("connection lost")),
      });

      await expect(
        service.exportAgreement("acuerdo-1", "user-a"),
      ).rejects.toThrow("connection lost");
    });
  });
});
