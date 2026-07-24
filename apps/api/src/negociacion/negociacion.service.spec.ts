import { HttpException, Logger } from "@nestjs/common";
import type { AiProposalGenerator } from "./ai/ai-proposal-generator";
import type { ConfiguracionRepository } from "./configuracion.repository";
import { NegociacionService } from "./negociacion.service";
import type { PropuestaView } from "./negociacion.types";
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
  currentRondaActual?: jest.Mock;
  findByNumero?: jest.Mock;
  insertNextRonda?: jest.Mock;
  readIaConfig?: jest.Mock;
  generateProposal?: jest.Mock;
}) {
  const membershipService = {
    assertMembership:
      overrides?.assertMembership ?? jest.fn().mockResolvedValue({}),
  };
  const propuestasRepository = {
    readBothPartyPositionsForEngine:
      overrides?.readBothPartyPositionsForEngine ??
      jest.fn().mockResolvedValue([]),
    createPending: overrides?.createPending ?? jest.fn(),
    patchGenerated: overrides?.patchGenerated ?? jest.fn(),
    existsForRonda:
      overrides?.existsForRonda ?? jest.fn().mockResolvedValue(false),
  } as unknown as PropuestasRepository;
  const rondasRepository = {
    currentRondaActual:
      overrides?.currentRondaActual ?? jest.fn().mockResolvedValue(1),
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
  } as unknown as AiProposalGenerator;
  return {
    service: new NegociacionService(
      membershipService as never,
      propuestasRepository,
      rondasRepository,
      configuracionRepository,
      aiProposalGenerator,
    ),
    membershipService,
    propuestasRepository,
    rondasRepository,
    configuracionRepository,
    aiProposalGenerator,
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

    expect(insertNextRonda).toHaveBeenCalledWith("caso-1", 1);
    expect(createPending).toHaveBeenCalledWith(
      "caso-1",
      "ronda-new",
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
    const currentRondaActual = jest.fn();
    const findByNumero = jest.fn();
    const insertNextRonda = jest.fn();
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      currentRondaActual,
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
    expect(currentRondaActual).not.toHaveBeenCalled();
    expect(findByNumero).not.toHaveBeenCalled();
    expect(insertNextRonda).not.toHaveBeenCalled();
  });

  it("throws a plain invariant error carrying casoId when the caso row is missing after membership passed", async () => {
    const readBothPartyPositionsForEngine = jest
      .fn()
      .mockResolvedValue(bothPartyPositions);
    const currentRondaActual = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      readBothPartyPositionsForEngine,
      currentRondaActual,
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
