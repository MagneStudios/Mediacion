import { HttpException } from "@nestjs/common";
import type { PlanLimitService } from "../pagos/plan-limit.service";
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
    updatePlazo?: jest.Mock;
    findPlazo?: jest.Mock;
    findContrapartes?: jest.Mock;
    assertMembership?: jest.Mock;
    assertCanCreateCase?: jest.Mock;
  }) {
    const casosRepository = {
      createCaseWithParteA: overrides?.createCaseWithParteA ?? jest.fn(),
      findOwnCases: overrides?.findOwnCases ?? jest.fn(),
      findDetailForMember: overrides?.findDetailForMember ?? jest.fn(),
      updatePlazo: overrides?.updatePlazo ?? jest.fn(),
      findPlazo: overrides?.findPlazo ?? jest.fn(),
      findContrapartes:
        overrides?.findContrapartes ?? jest.fn().mockResolvedValue([]),
    } as unknown as CasosRepository;
    const membershipService = {
      assertMembership: overrides?.assertMembership ?? jest.fn(),
    } as unknown as MembershipService;
    const planLimitService = {
      assertCanCreateCase:
        overrides?.assertCanCreateCase ??
        jest.fn().mockResolvedValue(undefined),
    } as unknown as PlanLimitService;
    return {
      service: new CasosService(
        casosRepository,
        membershipService,
        planLimitService,
      ),
      casosRepository,
      membershipService,
      planLimitService,
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

    it("rejects when the plan limit service denies case creation, without touching the repository", async () => {
      const planLimitExceeded = new HttpException(
        { code: "plan_limit_exceeded", message: "Plan case limit reached" },
        403,
      );
      const assertCanCreateCase = jest
        .fn()
        .mockRejectedValue(planLimitExceeded);
      const createCaseWithParteA = jest.fn();
      const { service } = buildService({
        assertCanCreateCase,
        createCaseWithParteA,
      });
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      let thrown: unknown;
      try {
        await service.createCase("user-1", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(planLimitExceeded);
      expect(assertCanCreateCase).toHaveBeenCalledWith("user-1");
      expect(createCaseWithParteA).not.toHaveBeenCalled();
    });

    it("checks the plan limit before creating the case when under the limit", async () => {
      const assertCanCreateCase = jest.fn().mockResolvedValue(undefined);
      const createCaseWithParteA = jest.fn().mockResolvedValue({
        id: "caso-1",
        estado: "nuevo",
      });
      const { service } = buildService({
        assertCanCreateCase,
        createCaseWithParteA,
      });
      const dto: CreateCasoDto = { nombre: "Divorcio", metodo: "mediacion" };

      await service.createCase("user-1", dto);

      expect(assertCanCreateCase).toHaveBeenCalledWith("user-1");
      expect(createCaseWithParteA).toHaveBeenCalledWith(dto, "user-1");
    });
  });

  describe("listOwnCases", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function summaryRow(overrides?: Record<string, unknown>) {
      return {
        id: "caso-1",
        nombre: "Divorcio",
        estado: "activo",
        metodo: "mediacion",
        created_at: "2026-07-01T00:00:00.000Z",
        plazo: null,
        sla_tipo: null,
        ronda_actual: 1,
        ...overrides,
      };
    }

    it("delegates to the repository using the caller's id", async () => {
      const findOwnCases = jest.fn().mockResolvedValue([summaryRow()]);
      const { service } = buildService({ findOwnCases });

      await service.listOwnCases("user-1");

      expect(findOwnCases).toHaveBeenCalledWith("user-1");
    });

    it("exposes the sla columns the dashboard needs and computes the semaforo", async () => {
      const findOwnCases = jest.fn().mockResolvedValue([
        summaryRow({
          plazo: "2026-07-24T20:00:00.000Z",
          sla_tipo: "negociacion",
          ronda_actual: 3,
        }),
      ]);
      const { service } = buildService({ findOwnCases });

      const [summary] = await service.listOwnCases("user-1");

      expect(summary.sla_tipo).toBe("negociacion");
      expect(summary.ronda_actual).toBe(3);
      expect(summary.plazo).toBe("2026-07-24T20:00:00.000Z");
      expect(summary.semaforo).toBe("rojo");
    });

    it("returns a null semaforo when the caso has no plazo", async () => {
      const findOwnCases = jest.fn().mockResolvedValue([summaryRow()]);
      const { service } = buildService({ findOwnCases });

      const [summary] = await service.listOwnCases("user-1");

      expect(summary.semaforo).toBeNull();
    });

    it("attaches the counterparty of each caso, asking only once for every caso id", async () => {
      const findOwnCases = jest
        .fn()
        .mockResolvedValue([
          summaryRow({ id: "caso-1" }),
          summaryRow({ id: "caso-2" }),
        ]);
      const findContrapartes = jest.fn().mockResolvedValue([
        {
          caso_id: "caso-2",
          usuario_id: "user-2",
          rol_en_caso: "parte_b",
          nombre: "Ana",
          apellido: "Perez",
        },
      ]);
      const { service } = buildService({ findOwnCases, findContrapartes });

      const [first, second] = await service.listOwnCases("user-1");

      expect(findContrapartes).toHaveBeenCalledTimes(1);
      expect(findContrapartes).toHaveBeenCalledWith(
        ["caso-1", "caso-2"],
        "user-1",
      );
      expect(first.contraparte).toBeNull();
      expect(second.contraparte).toEqual({
        usuario_id: "user-2",
        rol_en_caso: "parte_b",
        nombre: "Ana",
        apellido: "Perez",
      });
    });

    it("does not query counterparties at all when the caller has no cases", async () => {
      const findOwnCases = jest.fn().mockResolvedValue([]);
      const findContrapartes = jest.fn();
      const { service } = buildService({ findOwnCases, findContrapartes });

      const result = await service.listOwnCases("user-1");

      expect(result).toEqual([]);
      expect(findContrapartes).not.toHaveBeenCalled();
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
      const detail = { id: "caso-1", nombre: "Divorcio", plazo: null };
      const findDetailForMember = jest.fn().mockResolvedValue(detail);
      const { service } = buildService({
        assertMembership,
        findDetailForMember,
      });

      const result = await service.getCaseDetail("caso-1", "user-1");

      expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-1");
      expect(findDetailForMember).toHaveBeenCalledWith("caso-1", "user-1");
      expect(result).toMatchObject({ id: "caso-1", nombre: "Divorcio" });
    });

    it("adds the semaforo and the counterparty to the detail payload", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-07-24T12:00:00.000Z"));
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-1",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const findDetailForMember = jest.fn().mockResolvedValue({
        id: "caso-1",
        nombre: "Divorcio",
        plazo: "2026-07-26T12:00:00.000Z",
        sla_tipo: "negociacion",
        ronda_actual: 2,
      });
      const findContrapartes = jest.fn().mockResolvedValue([
        {
          caso_id: "caso-1",
          usuario_id: "user-2",
          rol_en_caso: "parte_b",
          nombre: "Ana",
          apellido: "Perez",
        },
      ]);
      const { service } = buildService({
        assertMembership,
        findDetailForMember,
        findContrapartes,
      });

      const result = await service.getCaseDetail("caso-1", "user-1");

      expect(result.semaforo).toBe("amarillo");
      expect(result.ronda_actual).toBe(2);
      expect(result.contraparte).toEqual({
        usuario_id: "user-2",
        rol_en_caso: "parte_b",
        nombre: "Ana",
        apellido: "Perez",
      });
      jest.useRealTimers();
    });

    it("reports a null counterparty while the other party has not joined yet", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-1",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const findDetailForMember = jest
        .fn()
        .mockResolvedValue({ id: "caso-1", nombre: "Divorcio", plazo: null });
      const findContrapartes = jest.fn().mockResolvedValue([]);
      const { service } = buildService({
        assertMembership,
        findDetailForMember,
        findContrapartes,
      });

      const result = await service.getCaseDetail("caso-1", "user-1");

      expect(result.contraparte).toBeNull();
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

  describe("setPlazo", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("updates plazo for an accepted party and returns the computed semaforo", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-a",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const updatePlazo = jest.fn().mockResolvedValue({
        id: "caso-1",
        plazo: "2026-08-24T12:00:00.000Z",
      });
      const { service } = buildService({ assertMembership, updatePlazo });

      const result = await service.setPlazo("caso-1", "user-a", {
        plazo: "2026-08-24T12:00:00.000Z",
      });

      expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-a");
      expect(updatePlazo).toHaveBeenCalledWith(
        "caso-1",
        "2026-08-24T12:00:00.000Z",
      );
      expect(result).toEqual({
        id: "caso-1",
        plazo: "2026-08-24T12:00:00.000Z",
        semaforo: "verde",
      });
    });

    it("rejects a non-member with 404, disclosing nothing about the case", async () => {
      const notFound = new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        404,
      );
      const assertMembership = jest.fn().mockRejectedValue(notFound);
      const updatePlazo = jest.fn();
      const { service } = buildService({ assertMembership, updatePlazo });

      let thrown: unknown;
      try {
        await service.setPlazo("caso-1", "stranger", {
          plazo: "2026-08-24T12:00:00.000Z",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(updatePlazo).not.toHaveBeenCalled();
    });

    it("rejects a plazo that is not a valid ISO date before touching membership or the repository", async () => {
      const assertMembership = jest.fn();
      const updatePlazo = jest.fn();
      const { service } = buildService({ assertMembership, updatePlazo });

      let thrown: unknown;
      try {
        await service.setPlazo("caso-1", "user-a", {
          plazo: "not-a-date",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(assertMembership).not.toHaveBeenCalled();
      expect(updatePlazo).not.toHaveBeenCalled();
    });

    it("rejects a plazo that is not in the future before touching membership or the repository", async () => {
      const assertMembership = jest.fn();
      const updatePlazo = jest.fn();
      const { service } = buildService({ assertMembership, updatePlazo });

      let thrown: unknown;
      try {
        await service.setPlazo("caso-1", "user-a", {
          plazo: "2026-07-24T00:00:00.000Z",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(assertMembership).not.toHaveBeenCalled();
      expect(updatePlazo).not.toHaveBeenCalled();
    });
  });

  describe("getPlazo", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns plazo and the computed semaforo for an accepted member", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-a",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const findPlazo = jest.fn().mockResolvedValue({
        id: "caso-1",
        plazo: "2026-07-24T00:00:00.000Z",
      });
      const { service } = buildService({ assertMembership, findPlazo });

      const result = await service.getPlazo("caso-1", "user-a");

      expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-a");
      expect(findPlazo).toHaveBeenCalledWith("caso-1");
      expect(result).toEqual({
        id: "caso-1",
        plazo: "2026-07-24T00:00:00.000Z",
        semaforo: "rojo",
      });
    });

    it("returns a null semaforo when plazo has not been set", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-a",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const findPlazo = jest.fn().mockResolvedValue({
        id: "caso-1",
        plazo: null,
      });
      const { service } = buildService({ assertMembership, findPlazo });

      const result = await service.getPlazo("caso-1", "user-a");

      expect(result).toEqual({ id: "caso-1", plazo: null, semaforo: null });
    });

    it("rejects a non-member with 404 without querying plazo", async () => {
      const notFound = new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        404,
      );
      const assertMembership = jest.fn().mockRejectedValue(notFound);
      const findPlazo = jest.fn();
      const { service } = buildService({ assertMembership, findPlazo });

      let thrown: unknown;
      try {
        await service.getPlazo("caso-1", "stranger");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(findPlazo).not.toHaveBeenCalled();
    });

    it("returns 404 when the caso itself no longer exists", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-a",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const findPlazo = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ assertMembership, findPlazo });

      let thrown: unknown;
      try {
        await service.getPlazo("caso-1", "user-a");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
    });
  });
});
