import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { CasosRepository } from "../casos/casos.repository";
import type { AiProposalGenerator } from "./ai/ai-proposal-generator";
import type { ConfiguracionRepository } from "./configuracion.repository";
import { NegociacionService } from "./negociacion.service";
import type { PropuestaView } from "./negociacion.types";
import type { NegociacionesRepository } from "./negociaciones.repository";
import type { PropuestasRepository } from "./propuestas.repository";
import type { RondasRepository } from "./rondas.repository";

const iaConfig = { modelo: "openai/gpt-4", temperature: 0.7, maxTokens: 500 };

const bothPartyPositions = [
  {
    parte_id: "user-a",
    categoria: "economico",
    nombre: "monto",
    valor_min: "100",
    valor_max: "500",
  },
  {
    parte_id: "user-b",
    categoria: "economico",
    nombre: "monto",
    valor_min: "200",
    valor_max: "400",
  },
];

function buildService(overrides?: {
  assertMembership?: jest.Mock;
  readBothPartyPositionsForEngine?: jest.Mock;
  createPending?: jest.Mock;
  patchGenerated?: jest.Mock;
  existsForRonda?: jest.Mock;
  resolveActiveNegociacion?: jest.Mock;
  findByNumero?: jest.Mock;
  insertNextRonda?: jest.Mock;
  readIaConfig?: jest.Mock;
  generateProposal?: jest.Mock;
  isConfigured?: jest.Mock;
  findCasoId?: jest.Mock;
  resolveRespuesta?: jest.Mock;
  findForCase?: jest.Mock;
  findDetailForCase?: jest.Mock;
  findDetailForNegociacion?: jest.Mock;
  listByCaso?: jest.Mock;
  findNegociacionById?: jest.Mock;
  crear?: jest.Mock;
  findDetailForMember?: jest.Mock;
  renegociar?: jest.Mock;
}) {
  const membershipService = {
    assertMembership:
      overrides?.assertMembership ??
      jest.fn().mockResolvedValue({ rol_en_caso: "parte_a" }),
  };
  const propuestasRepository = {
    readBothPartyPositionsForEngine:
      overrides?.readBothPartyPositionsForEngine ??
      jest.fn().mockResolvedValue([]),
    createPending: overrides?.createPending ?? jest.fn(),
    patchGenerated: overrides?.patchGenerated ?? jest.fn(),
    existsForRonda:
      overrides?.existsForRonda ?? jest.fn().mockResolvedValue(false),
    findCasoId: overrides?.findCasoId ?? jest.fn().mockResolvedValue("caso-1"),
    resolveRespuesta: overrides?.resolveRespuesta ?? jest.fn(),
    findForCase: overrides?.findForCase ?? jest.fn().mockResolvedValue([]),
    findDetailForCase:
      overrides?.findDetailForCase ?? jest.fn().mockResolvedValue([]),
    findDetailForNegociacion:
      overrides?.findDetailForNegociacion ?? jest.fn().mockResolvedValue([]),
  } as unknown as PropuestasRepository;
  const rondasRepository = {
    resolveActiveNegociacion:
      overrides?.resolveActiveNegociacion ??
      jest.fn().mockResolvedValue({ id: "negociacion-1", round: 1 }),
    findByNumero:
      overrides?.findByNumero ??
      jest
        .fn()
        .mockResolvedValue({ id: "ronda-1", caso_id: "caso-1", numero: 1 }),
    insertNextRonda: overrides?.insertNextRonda ?? jest.fn(),
  } as unknown as RondasRepository;
  const configuracionRepository = {
    readIaConfig:
      overrides?.readIaConfig ?? jest.fn().mockResolvedValue(iaConfig),
  } as unknown as ConfiguracionRepository;
  const aiProposalGenerator = {
    generateProposal:
      overrides?.generateProposal ??
      jest.fn().mockResolvedValue({ text: "Propuesta generada." }),
    isConfigured: overrides?.isConfigured ?? jest.fn().mockReturnValue(true),
  } as unknown as AiProposalGenerator;
  const casosRepository = {
    activateNegotiation: jest.fn().mockResolvedValue(undefined),
    findDetailForMember:
      overrides?.findDetailForMember ??
      jest.fn().mockResolvedValue({
        id: "caso-1",
        estado: "en_negociacion",
        metodo: "mediacion",
      }),
  } as unknown as CasosRepository;
  const negociacionesRepository = {
    listByCaso: overrides?.listByCaso ?? jest.fn().mockResolvedValue([]),
    findById:
      overrides?.findNegociacionById ??
      jest.fn().mockResolvedValue({ caso_id: "caso-1", round: 1 }),
    crear:
      overrides?.crear ??
      jest.fn().mockResolvedValue({
        id: "negociacion-2",
        caso_id: "caso-1",
        subject_type: "alimentos",
        metodo: "mediacion",
        estado: "borrador",
        ronda_actual: 1,
        acuerdo_vigente: null,
        created_at: "now",
      }),
    renegociar:
      overrides?.renegociar ??
      jest.fn().mockResolvedValue({
        negotiation_id: "negociacion-1",
        agreement_id: "acuerdo-2",
      }),
  } as unknown as NegociacionesRepository;
  return {
    service: new NegociacionService(
      membershipService as never,
      casosRepository as never,
      propuestasRepository,
      rondasRepository,
      configuracionRepository,
      aiProposalGenerator,
      negociacionesRepository,
    ),
    negociacionesRepository,
    membershipService,
    propuestasRepository,
    rondasRepository,
    configuracionRepository,
    aiProposalGenerator,
    casosRepository,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("NegociacionService.generatePropuesta", () => {
  it("propagates the 404 thrown by the membership guard for non-members", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const assertMembership = jest.fn().mockRejectedValue(notFound);
    const { service, propuestasRepository } = buildService({
      assertMembership,
    });

    await expect(service.generatePropuesta("caso-1", "stranger")).rejects.toBe(
      notFound,
    );
    expect(
      propuestasRepository.readBothPartyPositionsForEngine,
    ).not.toHaveBeenCalled();
  });

  it("creates the propuesta as pendiente with only the meeting point before generation completes", async () => {
    const readBothPartyPositionsForEngine = jest.fn().mockResolvedValue([
      {
        parte_id: "user-a",
        categoria: "economico",
        nombre: "monto",
        valor_min: "100",
        valor_max: "500",
      },
      {
        parte_id: "user-b",
        categoria: "economico",
        nombre: "monto",
        valor_min: "200",
        valor_max: "400",
      },
    ]);
    const pending: PropuestaView = {
      id: "prop-1",
      caso_id: "caso-1",
      negociacion_id: "neg-1",
      ronda_id: "ronda-1",
      contenido: {
        meetingPoint: [
          { categoria: "economico", punto: 300, estado: "acordable" },
        ],
        narrative: null,
      },
      fundamentacion: null,
      estado: "pendiente",
      modelo_ia: "openai/gpt-4",
      fecha: "now",
    };
    const createPending = jest.fn().mockResolvedValue(pending);
    const generateProposal = jest
      .fn()
      .mockResolvedValue({ text: "Narrativa." });
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      createPending,
      generateProposal,
    });

    const result = await service.generatePropuesta("caso-1", "user-a");

    expect(createPending).toHaveBeenCalledWith(
      "caso-1",
      "ronda-1",
      "negociacion-1",
      {
        meetingPoint: [
          { categoria: "economico", punto: 300, estado: "acordable" },
        ],
        narrative: null,
      },
      "openai/gpt-4",
    );
    expect(result).toBe(pending);
  });

  it("creates the first ronda when none exists yet for the case", async () => {
    const findByNumero = jest.fn().mockResolvedValue(undefined);
    const insertNextRonda = jest
      .fn()
      .mockResolvedValue({ id: "ronda-new", caso_id: "caso-1", numero: 1 });
    const readBothPartyPositionsForEngine = jest.fn().mockResolvedValue([
      {
        parte_id: "user-a",
        categoria: "economico",
        nombre: "monto",
        valor_min: "100",
        valor_max: "500",
      },
      {
        parte_id: "user-b",
        categoria: "economico",
        nombre: "monto",
        valor_min: "200",
        valor_max: "400",
      },
    ]);
    const createPending = jest.fn().mockResolvedValue({ id: "prop-1" });
    const { service } = buildService({
      findByNumero,
      insertNextRonda,
      readBothPartyPositionsForEngine,
      createPending,
    });

    await service.generatePropuesta("caso-1", "user-a");

    expect(insertNextRonda).toHaveBeenCalledWith("caso-1", "negociacion-1", 1);
    expect(createPending).toHaveBeenCalledWith(
      "caso-1",
      "ronda-new",
      "negociacion-1",
      expect.anything(),
      expect.anything(),
    );
  });

  it("RN-01 adversarial: the AI prompt never carries either party's raw ranges, so an echoing generator cannot leak them", async () => {
    const rawValorMinA = "137";
    const rawValorMaxA = "889";
    const rawValorMinB = "222";
    const rawValorMaxB = "654";
    const readBothPartyPositionsForEngine = jest.fn().mockResolvedValue([
      {
        parte_id: "user-a",
        categoria: "economico",
        nombre: "monto",
        valor_min: rawValorMinA,
        valor_max: rawValorMaxA,
      },
      {
        parte_id: "user-b",
        categoria: "economico",
        nombre: "monto",
        valor_min: rawValorMinB,
        valor_max: rawValorMaxB,
      },
    ]);
    const generateProposal = jest.fn(async (input: { prompt: string }) => ({
      text: input.prompt,
    }));
    const patchGenerated = jest.fn();
    const createPending = jest.fn().mockResolvedValue({ id: "prop-1" });
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      createPending,
      generateProposal,
      patchGenerated,
    });

    await service.generatePropuesta("caso-1", "user-a");
    await flushMicrotasks();

    expect(patchGenerated).toHaveBeenCalledTimes(1);
    const [, , contenido, fundamentacion] = patchGenerated.mock.calls[0];
    const serialized = JSON.stringify(contenido) + String(fundamentacion);
    for (const raw of [
      rawValorMinA,
      rawValorMaxA,
      rawValorMinB,
      rawValorMaxB,
    ]) {
      expect(serialized).not.toContain(raw);
    }
  });

  it("generation failure leaves the propuesta pendiente with narrative still null, without patching bad state", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const readBothPartyPositionsForEngine = jest.fn().mockResolvedValue([
      {
        parte_id: "user-a",
        categoria: "economico",
        nombre: "monto",
        valor_min: "100",
        valor_max: "500",
      },
      {
        parte_id: "user-b",
        categoria: "economico",
        nombre: "monto",
        valor_min: "200",
        valor_max: "400",
      },
    ]);
    const createPending = jest.fn().mockResolvedValue({ id: "prop-1" });
    const generateProposal = jest
      .fn()
      .mockRejectedValue(new Error("openrouter unreachable"));
    const patchGenerated = jest.fn();
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      createPending,
      generateProposal,
      patchGenerated,
    });

    const result = await service.generatePropuesta("caso-1", "user-a");
    await flushMicrotasks();

    expect(result).toEqual({ id: "prop-1" });
    expect(patchGenerated).not.toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it("logs the failure with propuesta/caso/ronda context when generation fails, without rejecting the caller", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const createPending = jest.fn().mockResolvedValue({ id: "prop-1" });
    const generateProposal = jest
      .fn()
      .mockRejectedValue(new Error("openrouter unreachable"));
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      createPending,
      generateProposal,
    });

    await expect(
      service.generatePropuesta("caso-1", "user-a"),
    ).resolves.toEqual({ id: "prop-1" });
    await flushMicrotasks();

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    const [message] = loggerSpy.mock.calls[0];
    expect(message).toEqual(expect.stringContaining("prop-1"));
    expect(message).toEqual(expect.stringContaining("caso-1"));
    expect(message).toEqual(expect.stringContaining("ronda-1"));
    loggerSpy.mockRestore();
  });

  it("rejects with 503 ia_not_configured and never creates a pending propuesta when the generator has no credentials", async () => {
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const createPending = jest.fn();
    const generateProposal = jest.fn();
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      createPending,
      generateProposal,
      isConfigured: jest.fn().mockReturnValue(false),
    });

    let thrown: unknown;
    try {
      await service.generatePropuesta("caso-1", "user-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((thrown as HttpException).getResponse()).toEqual({
      code: "ia_not_configured",
      message: expect.any(String),
    });
    expect(createPending).not.toHaveBeenCalled();
    expect(generateProposal).not.toHaveBeenCalled();
  });

  it("rejects with 422 both_parties_required and never resolves/creates a ronda when positions are incomplete", async () => {
    const readBothPartyPositionsForEngine = jest.fn().mockResolvedValue([
      {
        parte_id: "user-a",
        categoria: "economico",
        nombre: "monto",
        valor_min: "100",
        valor_max: "500",
      },
    ]);
    const resolveActiveNegociacion = jest.fn();
    const findByNumero = jest.fn();
    const insertNextRonda = jest.fn();
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      resolveActiveNegociacion,
      findByNumero,
      insertNextRonda,
    });

    let thrown: unknown;
    try {
      await service.generatePropuesta("caso-1", "user-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(422);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "both_parties_required",
    });
    expect(resolveActiveNegociacion).not.toHaveBeenCalled();
    expect(findByNumero).not.toHaveBeenCalled();
    expect(insertNextRonda).not.toHaveBeenCalled();
  });

  it("throws a plain invariant error carrying casoId when the caso row is missing after membership passed", async () => {
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const resolveActiveNegociacion = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      resolveActiveNegociacion,
    });

    let thrown: unknown;
    try {
      await service.generatePropuesta("caso-1", "user-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(HttpException);
    expect((thrown as Error).message).toContain("caso-1");
  });

  it("rejects with 409 propuesta_already_exists when a propuesta already exists for the active ronda, without creating one or calling the AI generator", async () => {
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const existsForRonda = jest.fn().mockResolvedValue(true);
    const createPending = jest.fn();
    const generateProposal = jest.fn();
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      existsForRonda,
      createPending,
      generateProposal,
    });

    let thrown: unknown;
    try {
      await service.generatePropuesta("caso-1", "user-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "propuesta_already_exists",
    });
    expect(existsForRonda).toHaveBeenCalledWith("caso-1", "ronda-1");
    expect(createPending).not.toHaveBeenCalled();
    expect(generateProposal).not.toHaveBeenCalled();
  });
});

describe("NegociacionService.responder", () => {
  it("rejects with 400 when decision is not acepta or rechaza", async () => {
    const findCasoId = jest.fn();
    const { service } = buildService({ findCasoId });

    let thrown: unknown;
    try {
      await service.responder("prop-1", "user-a", "maybe" as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect(findCasoId).not.toHaveBeenCalled();
  });

  it("returns a uniform 404 when the propuesta does not exist", async () => {
    const findCasoId = jest.fn().mockResolvedValue(undefined);
    const assertMembership = jest.fn();
    const { service } = buildService({ findCasoId, assertMembership });

    let thrown: unknown;
    try {
      await service.responder("missing", "user-a", "acepta");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "caso_not_found",
    });
    expect(assertMembership).not.toHaveBeenCalled();
  });

  it("propagates the 404 thrown by the membership guard for non-members", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const assertMembership = jest.fn().mockRejectedValue(notFound);
    const resolveRespuesta = jest.fn();
    const { service } = buildService({ assertMembership, resolveRespuesta });

    await expect(
      service.responder("prop-1", "stranger", "acepta"),
    ).rejects.toBe(notFound);
    expect(resolveRespuesta).not.toHaveBeenCalled();
  });

  it("returns a uniform 404 for a mediador, who cannot respond to a propuesta", async () => {
    const assertMembership = jest
      .fn()
      .mockResolvedValue({ rol_en_caso: "mediador" });
    const resolveRespuesta = jest.fn();
    const { service } = buildService({ assertMembership, resolveRespuesta });

    let thrown: unknown;
    try {
      await service.responder("prop-1", "user-mediador", "acepta");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
    expect(resolveRespuesta).not.toHaveBeenCalled();
  });

  it("delegates to the repository for a parte, returning its result", async () => {
    const aceptada: PropuestaView = {
      id: "prop-1",
      caso_id: "caso-1",
      negociacion_id: "neg-1",
      ronda_id: "ronda-1",
      contenido: { meetingPoint: [], narrative: "texto" },
      fundamentacion: null,
      estado: "aceptada",
      modelo_ia: "openai/gpt-4",
      fecha: "now",
    };
    const resolveRespuesta = jest.fn().mockResolvedValue(aceptada);
    const { service } = buildService({ resolveRespuesta });

    const result = await service.responder("prop-1", "user-a", "acepta");

    expect(resolveRespuesta).toHaveBeenCalledWith(
      "caso-1",
      "prop-1",
      "user-a",
      "acepta",
    );
    expect(result).toBe(aceptada);
  });
});

describe("NegociacionService.listPropuestas", () => {
  it("propagates the 404 thrown by the membership guard for non-members", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const assertMembership = jest.fn().mockRejectedValue(notFound);
    const { service } = buildService({ assertMembership });

    await expect(service.listPropuestas("caso-1", "stranger")).rejects.toBe(
      notFound,
    );
  });

  it("returns the propuestas for a parte regardless of round", async () => {
    const assertMembership = jest
      .fn()
      .mockResolvedValue({ rol_en_caso: "parte_a" });
    const resolveActiveNegociacion = jest.fn();
    const propuestas: PropuestaView[] = [];
    const findDetailForCase = jest.fn().mockResolvedValue(propuestas);
    const { service } = buildService({
      assertMembership,
      resolveActiveNegociacion,
      findDetailForCase,
    });

    const result = await service.listPropuestas("caso-1", "user-a");

    expect(result).toBe(propuestas);
    expect(resolveActiveNegociacion).not.toHaveBeenCalled();
  });

  it("returns a uniform 404 for a mediador before round 3", async () => {
    const assertMembership = jest
      .fn()
      .mockResolvedValue({ rol_en_caso: "mediador" });
    const resolveActiveNegociacion = jest
      .fn()
      .mockResolvedValue({ id: "negociacion-1", round: 2 });
    const findDetailForCase = jest.fn();
    const { service } = buildService({
      assertMembership,
      resolveActiveNegociacion,
      findDetailForCase,
    });

    let thrown: unknown;
    try {
      await service.listPropuestas("caso-1", "user-mediador");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
    expect(findDetailForCase).not.toHaveBeenCalled();
  });

  it("returns the propuestas for a mediador from round 3 onward", async () => {
    const assertMembership = jest
      .fn()
      .mockResolvedValue({ rol_en_caso: "mediador" });
    const resolveActiveNegociacion = jest
      .fn()
      .mockResolvedValue({ id: "negociacion-1", round: 3 });
    const propuestas: PropuestaView[] = [];
    const findDetailForCase = jest.fn().mockResolvedValue(propuestas);
    const { service } = buildService({
      assertMembership,
      resolveActiveNegociacion,
      findDetailForCase,
    });

    const result = await service.listPropuestas("caso-1", "user-mediador");

    expect(result).toBe(propuestas);
  });

  it("asks for the snapshot scoped to the caller, so own_decision is the caller's own", async () => {
    const assertMembership = jest
      .fn()
      .mockResolvedValue({ rol_en_caso: "parte_b" });
    const findDetailForCase = jest.fn().mockResolvedValue([]);
    const { service } = buildService({ assertMembership, findDetailForCase });

    await service.listPropuestas("caso-1", "user-b");

    expect(findDetailForCase).toHaveBeenCalledWith("caso-1", "user-b");
  });

  describe("listNegociaciones", () => {
    it("returns the negociaciones of the caso to a member", async () => {
      const negociaciones = [{ id: "negociacion-1", subject_type: "tenencia" }];
      const listByCaso = jest.fn().mockResolvedValue(negociaciones);
      const { service } = buildService({ listByCaso });

      const result = await service.listNegociaciones("caso-1", "user-a");

      expect(listByCaso).toHaveBeenCalledWith("caso-1");
      expect(result).toBe(negociaciones);
    });

    it("returns an empty list, not a 404, for a caso with no negociaciones", async () => {
      const { service } = buildService({
        listByCaso: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.listNegociaciones("caso-1", "user-a"),
      ).resolves.toEqual([]);
    });

    it("blocks non-members before reading any negociacion", async () => {
      const listByCaso = jest.fn();
      const { service } = buildService({
        listByCaso,
        assertMembership: jest
          .fn()
          .mockRejectedValue(
            new HttpException(
              { code: "caso_not_found", message: "Case not found" },
              404,
            ),
          ),
      });

      await expect(
        service.listNegociaciones("caso-1", "outsider"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "caso_not_found" },
      });
      expect(listByCaso).not.toHaveBeenCalled();
    });
  });
});

describe("NegociacionService.renegociar", () => {
  it("delegates to the repository once the caller is a party of the negociacion's caso", async () => {
    const renegociar = jest.fn().mockResolvedValue({
      negotiation_id: "negociacion-1",
      agreement_id: "acuerdo-2",
    });
    const assertMembership = jest
      .fn()
      .mockResolvedValue({ rol_en_caso: "parte_a" });
    const { service } = buildService({ renegociar, assertMembership });

    const result = await service.renegociar("negociacion-1", "user-a");

    expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-a");
    expect(renegociar).toHaveBeenCalledWith("negociacion-1");
    expect(result).toEqual({
      negotiation_id: "negociacion-1",
      agreement_id: "acuerdo-2",
    });
  });

  it("rejects with 404 negociacion_not_found for an id that does not exist, without asserting membership", async () => {
    const assertMembership = jest.fn();
    const renegociar = jest.fn();
    const { service } = buildService({
      findNegociacionById: jest.fn().mockResolvedValue(undefined),
      assertMembership,
      renegociar,
    });

    let thrown: unknown;
    try {
      await service.renegociar("negociacion-9", "user-a");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "negociacion_not_found" }),
    );
    expect(assertMembership).not.toHaveBeenCalled();
    expect(renegociar).not.toHaveBeenCalled();
  });

  it("propagates the membership 404 for a caller who is not a party", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      HttpStatus.NOT_FOUND,
    );
    const renegociar = jest.fn();
    const { service } = buildService({
      assertMembership: jest.fn().mockRejectedValue(notFound),
      renegociar,
    });

    await expect(service.renegociar("negociacion-1", "stranger")).rejects.toBe(
      notFound,
    );
    expect(renegociar).not.toHaveBeenCalled();
  });

  it("rejects the mediador with 404 rather than leaking that the negociacion exists", async () => {
    const renegociar = jest.fn();
    const { service } = buildService({
      assertMembership: jest
        .fn()
        .mockResolvedValue({ rol_en_caso: "mediador" }),
      renegociar,
    });

    let thrown: unknown;
    try {
      await service.renegociar("negociacion-1", "mediador-1");
    } catch (error) {
      thrown = error;
    }

    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(renegociar).not.toHaveBeenCalled();
  });
});

describe("NegociacionService.crearNegociacion", () => {
  it("inherits the caso's metodo and returns the new materia", async () => {
    const crear = jest.fn().mockResolvedValue({
      id: "negociacion-2",
      caso_id: "caso-1",
      subject_type: "alimentos",
      metodo: "conciliacion",
      estado: "borrador",
      ronda_actual: 1,
      acuerdo_vigente: null,
      created_at: "now",
    });
    const { service } = buildService({
      crear,
      findDetailForMember: jest.fn().mockResolvedValue({
        id: "caso-1",
        estado: "en_negociacion",
        metodo: "conciliacion",
      }),
    });

    const result = await service.crearNegociacion("caso-1", "user-a", {
      subject_type: "alimentos",
    });

    expect(crear).toHaveBeenCalledWith("caso-1", "alimentos", "conciliacion");
    expect(result.subject_type).toBe("alimentos");
    expect(result.acuerdo_vigente).toBeNull();
  });

  it("rejects a subject_type outside the materia_acuerdo enum with 400 before touching the repository", async () => {
    const crear = jest.fn();
    const assertMembership = jest.fn();
    const { service } = buildService({ crear, assertMembership });

    let thrown: unknown;
    try {
      await service.crearNegociacion("caso-1", "user-a", {
        subject_type: "vivienda" as never,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "invalid_input",
    });
    expect(assertMembership).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });

  it("rejects a missing body with 400 rather than inserting a materia-less negociacion", async () => {
    const crear = jest.fn();
    const { service } = buildService({ crear });

    await expect(
      service.crearNegociacion("caso-1", "user-a", undefined as never),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(crear).not.toHaveBeenCalled();
  });

  it("propagates the membership 404 for a caller who is not a party", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      HttpStatus.NOT_FOUND,
    );
    const crear = jest.fn();
    const { service } = buildService({
      crear,
      assertMembership: jest.fn().mockRejectedValue(notFound),
    });

    await expect(
      service.crearNegociacion("caso-1", "stranger", {
        subject_type: "bienes",
      }),
    ).rejects.toBe(notFound);
    expect(crear).not.toHaveBeenCalled();
  });

  it("rejects the mediador with 404 — splitting the caso by materia is a party's act", async () => {
    const crear = jest.fn();
    const { service } = buildService({
      crear,
      assertMembership: jest
        .fn()
        .mockResolvedValue({ rol_en_caso: "mediador" }),
    });

    await expect(
      service.crearNegociacion("caso-1", "mediador-1", {
        subject_type: "bienes",
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: "caso_not_found" },
    });
    expect(crear).not.toHaveBeenCalled();
  });

  it("rejects with 409 caso_no_negociable on a caso that is already terminado", async () => {
    const crear = jest.fn();
    const { service } = buildService({
      crear,
      findDetailForMember: jest.fn().mockResolvedValue({
        id: "caso-1",
        estado: "terminado",
        metodo: "mediacion",
      }),
    });

    let thrown: unknown;
    try {
      await service.crearNegociacion("caso-1", "user-a", {
        subject_type: "bienes",
      });
    } catch (error) {
      thrown = error;
    }

    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "caso_no_negociable",
    });
    expect(crear).not.toHaveBeenCalled();
  });

  it("allows a materia on an acordado caso — the repository is what reopens it", async () => {
    const crear = jest.fn().mockResolvedValue({
      id: "negociacion-2",
      caso_id: "caso-1",
      subject_type: "bienes",
      metodo: "mediacion",
      estado: "borrador",
      ronda_actual: 1,
      acuerdo_vigente: null,
      created_at: "now",
    });
    const { service } = buildService({
      crear,
      findDetailForMember: jest.fn().mockResolvedValue({
        id: "caso-1",
        estado: "acordado",
        metodo: "mediacion",
      }),
    });

    await service.crearNegociacion("caso-1", "user-a", {
      subject_type: "bienes",
    });

    expect(crear).toHaveBeenCalledWith("caso-1", "bienes", "mediacion");
  });
});

describe("NegociacionService.generatePropuestaForNegociacion", () => {
  it("creates the propuesta on the addressed negociacion and its own round", async () => {
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const findByNumero = jest
      .fn()
      .mockResolvedValue({ id: "ronda-7", caso_id: "caso-1", numero: 2 });
    const createPending = jest.fn().mockResolvedValue({ id: "prop-9" });
    const resolveActiveNegociacion = jest.fn();
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      findByNumero,
      createPending,
      resolveActiveNegociacion,
      findNegociacionById: jest
        .fn()
        .mockResolvedValue({ caso_id: "caso-1", round: 2 }),
    });

    await service.generatePropuestaForNegociacion("negociacion-2", "user-a");

    expect(findByNumero).toHaveBeenCalledWith("negociacion-2", 2);
    expect(createPending).toHaveBeenCalledWith(
      "caso-1",
      "ronda-7",
      "negociacion-2",
      expect.anything(),
      iaConfig.modelo,
    );
    expect(resolveActiveNegociacion).not.toHaveBeenCalled();
  });

  it("opens the ronda of that negociacion when it has none yet", async () => {
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const findByNumero = jest.fn().mockResolvedValue(undefined);
    const insertNextRonda = jest.fn().mockResolvedValue({ id: "ronda-nueva" });
    const createPending = jest.fn().mockResolvedValue({ id: "prop-9" });
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      findByNumero,
      insertNextRonda,
      createPending,
      findNegociacionById: jest
        .fn()
        .mockResolvedValue({ caso_id: "caso-1", round: 1 }),
    });

    await service.generatePropuestaForNegociacion("negociacion-2", "user-a");

    expect(insertNextRonda).toHaveBeenCalledWith("caso-1", "negociacion-2", 1);
    expect(createPending).toHaveBeenCalledWith(
      "caso-1",
      "ronda-nueva",
      "negociacion-2",
      expect.anything(),
      iaConfig.modelo,
    );
  });

  it("rejects with 404 negociacion_not_found for an unknown id, without asserting membership", async () => {
    const assertMembership = jest.fn();
    const createPending = jest.fn();
    const { service } = buildService({
      assertMembership,
      createPending,
      findNegociacionById: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.generatePropuestaForNegociacion("negociacion-9", "user-a"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: "negociacion_not_found" },
    });
    expect(assertMembership).not.toHaveBeenCalled();
    expect(createPending).not.toHaveBeenCalled();
  });
});

describe("NegociacionService.listPropuestasForNegociacion", () => {
  it("returns the propuestas of that materia for a parte", async () => {
    const detail = [{ id: "prop-1" }];
    const findDetailForNegociacion = jest.fn().mockResolvedValue(detail);
    const { service } = buildService({ findDetailForNegociacion });

    const result = await service.listPropuestasForNegociacion(
      "negociacion-2",
      "user-a",
    );

    expect(findDetailForNegociacion).toHaveBeenCalledWith(
      "negociacion-2",
      "user-a",
    );
    expect(result).toBe(detail);
  });

  it("hides a materia below ronda 3 from the mediador — RN-05 read per materia", async () => {
    const findDetailForNegociacion = jest.fn();
    const { service } = buildService({
      findDetailForNegociacion,
      assertMembership: jest
        .fn()
        .mockResolvedValue({ rol_en_caso: "mediador" }),
      findNegociacionById: jest
        .fn()
        .mockResolvedValue({ caso_id: "caso-1", round: 2 }),
    });

    await expect(
      service.listPropuestasForNegociacion("negociacion-2", "mediador-1"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: "negociacion_not_found" },
    });
    expect(findDetailForNegociacion).not.toHaveBeenCalled();
  });

  it("lets the mediador read a materia that reached ronda 3, whatever the other materias are on", async () => {
    const detail = [{ id: "prop-1" }];
    const findDetailForNegociacion = jest.fn().mockResolvedValue(detail);
    const { service } = buildService({
      findDetailForNegociacion,
      assertMembership: jest
        .fn()
        .mockResolvedValue({ rol_en_caso: "mediador" }),
      findNegociacionById: jest
        .fn()
        .mockResolvedValue({ caso_id: "caso-1", round: 3 }),
    });

    const result = await service.listPropuestasForNegociacion(
      "negociacion-2",
      "mediador-1",
    );

    expect(result).toBe(detail);
  });

  it("rejects with 404 negociacion_not_found for an unknown id", async () => {
    const findDetailForNegociacion = jest.fn();
    const { service } = buildService({
      findDetailForNegociacion,
      findNegociacionById: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.listPropuestasForNegociacion("negociacion-9", "user-a"),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: "negociacion_not_found" },
    });
    expect(findDetailForNegociacion).not.toHaveBeenCalled();
  });
});
