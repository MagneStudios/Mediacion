import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { CasosRepository } from "../casos/casos.repository";
import type { EstadoCaso } from "../casos/casos.types";
import { MembershipService } from "../casos/membership.service";
import type { AiProposalGenerator } from "./ai/ai-proposal-generator";
import { AI_PROPOSAL_GENERATOR } from "./ai/ai-proposal-generator";
import { ConfiguracionRepository } from "./configuracion.repository";
import type { MeetingPointEntry, PositionInput } from "./meeting-point";
import { computeMeetingPoints } from "./meeting-point";
import type {
  CreateNegociacionDto,
  DecisionPropuesta,
  IaConfig,
  MateriaAcuerdo,
  NegociacionView,
  PropuestaContenido,
  PropuestaDetail,
  PropuestaView,
  RenegociacionView,
} from "./negociacion.types";
import { materiasAcuerdo } from "./negociacion.types";
import { NegociacionesRepository } from "./negociaciones.repository";
import type { EnginePosition } from "./propuestas.repository";
import { PropuestasRepository } from "./propuestas.repository";
import { RondasRepository } from "./rondas.repository";

const rolMediador = "mediador" as const;
const rn05MediadorDesdeRonda = 3;
const validDecisiones: DecisionPropuesta[] = ["acepta", "rechaza"];
const estadosCasoNegociables: EstadoCaso[] = [
  "nuevo",
  "activo",
  "en_negociacion",
  "acordado",
];

function negociacionNotFound(): HttpException {
  return new HttpException(
    { code: "negociacion_not_found", message: "Negociacion not found" },
    HttpStatus.NOT_FOUND,
  );
}

function bothPartiesRequired(): HttpException {
  return new HttpException(
    {
      code: "both_parties_required",
      message: "Both parties must submit items before generating a proposal",
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function propuestaAlreadyExists(): HttpException {
  return new HttpException(
    {
      code: "propuesta_already_exists",
      message: "A propuesta already exists for the active ronda",
    },
    HttpStatus.CONFLICT,
  );
}

function iaNotConfigured(): HttpException {
  return new HttpException(
    {
      code: "ia_not_configured",
      message:
        "The AI proposal engine is not configured on this deployment (OPENROUTER_API_KEY)",
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

function casoNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

function casoNoNegociable(estado: EstadoCaso): HttpException {
  return new HttpException(
    {
      code: "caso_no_negociable",
      message: `A caso in estado ${estado} cannot open another negociacion`,
    },
    HttpStatus.CONFLICT,
  );
}

function assertValidMateria(materia: MateriaAcuerdo): void {
  if (!materiasAcuerdo.includes(materia)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `subject_type must be one of ${materiasAcuerdo.join(", ")}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidDecision(decision: DecisionPropuesta): void {
  if (!validDecisiones.includes(decision)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `decision must be one of ${validDecisiones.join(", ")}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function groupPositionsByParty(
  positions: EnginePosition[],
  firstPartyId: string,
  secondPartyId: string,
): [PositionInput[], PositionInput[]] {
  const toPosition = (position: EnginePosition): PositionInput => ({
    categoria: position.categoria,
    valor_min: position.valor_min,
    valor_max: position.valor_max,
  });
  return [
    positions
      .filter((position) => position.parte_id === firstPartyId)
      .map(toPosition),
    positions
      .filter((position) => position.parte_id === secondPartyId)
      .map(toPosition),
  ];
}

function assertBothPartiesSubmitted(
  positions: EnginePosition[],
): [PositionInput[], PositionInput[]] {
  const partyIds = [...new Set(positions.map((position) => position.parte_id))];
  if (partyIds.length !== 2) {
    throw bothPartiesRequired();
  }
  const [firstPartyId, secondPartyId] = partyIds;
  return groupPositionsByParty(positions, firstPartyId, secondPartyId);
}

function buildPrompt(meetingPoint: MeetingPointEntry[]): string {
  const lines = meetingPoint.map(
    (entry) =>
      `${entry.categoria}: ${entry.punto === null ? "sin punto numérico" : entry.punto} (${entry.estado})`,
  );
  return [
    "Redactá una narrativa breve y neutral para una propuesta de mediación",
    "basada exclusivamente en los siguientes puntos de encuentro calculados:",
    ...lines,
  ].join("\n");
}

@Injectable()
export class NegociacionService {
  private readonly logger = new Logger(NegociacionService.name);

  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(CasosRepository)
    private readonly casosRepository: CasosRepository,
    @Inject(PropuestasRepository)
    private readonly propuestasRepository: PropuestasRepository,
    @Inject(RondasRepository)
    private readonly rondasRepository: RondasRepository,
    @Inject(ConfiguracionRepository)
    private readonly configuracionRepository: ConfiguracionRepository,
    @Inject(AI_PROPOSAL_GENERATOR)
    private readonly aiProposalGenerator: AiProposalGenerator,
    @Inject(NegociacionesRepository)
    private readonly negociacionesRepository: NegociacionesRepository,
  ) {}

  /**
   * The caso-scoped generation, which resolves the caso's materia-less
   * negociacion. Kept for a caso that was never split: once materias exist the
   * client addresses each one through `generatePropuestaForNegociacion`.
   */
  async generatePropuesta(
    casoId: string,
    callerId: string,
  ): Promise<PropuestaView> {
    await this.membershipService.assertMembership(casoId, callerId);
    const positions = await this.readSubmittedPositions(casoId);
    const activa = await this.rondasRepository.resolveActiveNegociacion(casoId);
    if (activa === undefined) {
      throw new Error(
        `Caso ${casoId} not found while resolving ronda_actual after membership was already asserted`,
      );
    }
    return this.createPropuestaFor(casoId, activa.id, activa.round, positions);
  }

  /**
   * Generation for one materia. Addressed by negociacion, so the caso is
   * resolved before membership can be asserted at all, the way `renegociar`
   * does it.
   */
  async generatePropuestaForNegociacion(
    negociacionId: string,
    callerId: string,
  ): Promise<PropuestaView> {
    const negociacion =
      await this.negociacionesRepository.findById(negociacionId);
    if (!negociacion) {
      throw negociacionNotFound();
    }
    await this.membershipService.assertMembership(
      negociacion.caso_id,
      callerId,
    );
    const positions = await this.readSubmittedPositions(negociacion.caso_id);
    return this.createPropuestaFor(
      negociacion.caso_id,
      negociacionId,
      negociacion.round,
      positions,
    );
  }

  /**
   * Positions are read per caso, not per materia: `items.negociacion_id`
   * exists in the schema but nothing writes it (`items.repository.ts` never
   * sets it), so filtering by materia here would compute every propuesta from
   * an empty position set. Splitting positions by materia belongs with the
   * items surface, not ahead of it.
   */
  private async readSubmittedPositions(
    casoId: string,
  ): Promise<[PositionInput[], PositionInput[]]> {
    if (!this.aiProposalGenerator.isConfigured()) {
      throw iaNotConfigured();
    }
    const positions =
      await this.propuestasRepository.readBothPartyPositionsForEngine(casoId);
    return assertBothPartiesSubmitted(positions);
  }

  private async createPropuestaFor(
    casoId: string,
    negociacionId: string,
    round: number,
    [positionsA, positionsB]: [PositionInput[], PositionInput[]],
  ): Promise<PropuestaView> {
    await this.casosRepository.activateNegotiation(casoId);
    // El caso y la materia arrancan juntos: hasta acá `negociaciones.estado`
    // se quedaba en su default `borrador` para siempre, porque lo único que
    // lo escribía era aceptar la propuesta (`acordada`) y renegociar.
    await this.negociacionesRepository.activar(negociacionId);
    const rondaId = await this.ensureActiveRonda(casoId, negociacionId, round);
    const alreadyExists = await this.propuestasRepository.existsForRonda(
      casoId,
      rondaId,
    );
    if (alreadyExists) {
      throw propuestaAlreadyExists();
    }
    const meetingPoint = computeMeetingPoints(positionsA, positionsB);
    const iaConfig = await this.configuracionRepository.readIaConfig();
    const contenido: PropuestaContenido = { meetingPoint, narrative: null };
    const pending = await this.propuestasRepository.createPending(
      casoId,
      rondaId,
      negociacionId,
      contenido,
      iaConfig.modelo,
    );
    this.completeGeneration(casoId, pending.id, meetingPoint, iaConfig).catch(
      (error: unknown) => {
        this.logger.error(
          `negociacion.completeGeneration failed propuestaId=${pending.id} casoId=${casoId} rondaId=${rondaId}`,
          error,
        );
      },
    );
    return pending;
  }

  async responder(
    propuestaId: string,
    callerId: string,
    decision: DecisionPropuesta,
  ): Promise<PropuestaView> {
    assertValidDecision(decision);
    const casoId = await this.propuestasRepository.findCasoId(propuestaId);
    if (!casoId) {
      throw casoNotFound();
    }
    const membership = await this.membershipService.assertMembership(
      casoId,
      callerId,
    );
    if (membership.rol_en_caso === rolMediador) {
      throw casoNotFound();
    }
    return this.propuestasRepository.resolveRespuesta(
      casoId,
      propuestaId,
      callerId,
      decision,
    );
  }

  async listPropuestas(
    casoId: string,
    callerId: string,
  ): Promise<PropuestaDetail[]> {
    const membership = await this.membershipService.assertMembership(
      casoId,
      callerId,
    );
    if (membership.rol_en_caso === rolMediador) {
      const activa =
        await this.rondasRepository.resolveActiveNegociacion(casoId);
      if (activa === undefined || activa.round < rn05MediadorDesdeRonda) {
        throw casoNotFound();
      }
    }
    return this.propuestasRepository.findDetailForCase(casoId, callerId);
  }

  /**
   * The negociaciones of a caso. A caso with none returns an empty list, not a
   * 404: a caso that has not been split by materia yet is a normal state, and
   * making the client read "none" as an error costs it a branch it should not
   * need.
   */
  async listNegociaciones(
    casoId: string,
    callerId: string,
  ): Promise<NegociacionView[]> {
    await this.membershipService.assertMembership(casoId, callerId);
    return this.negociacionesRepository.listByCaso(casoId);
  }

  /**
   * Opens another materia on a caso. This is how a caso reaches more than one
   * negociacion at all: `POST /casos` creates exactly one, materia-less, and
   * nothing else inserted into `negociaciones` before this route.
   *
   * `method` is inherited from the caso rather than taken from the body: the
   * metodo is a property of the caso the parties agreed on, and letting a
   * client pick a different one per materia would make `negociaciones.method`
   * disagree with `casos.metodo` with no rule saying which wins.
   *
   * The mediador is excluded the way `responder` and `renegociar` exclude
   * them: splitting the case into materias is a party's act.
   */
  async crearNegociacion(
    casoId: string,
    callerId: string,
    body: CreateNegociacionDto,
  ): Promise<NegociacionView> {
    assertValidMateria(body?.subject_type);
    const membership = await this.membershipService.assertMembership(
      casoId,
      callerId,
    );
    if (membership.rol_en_caso === rolMediador) {
      throw casoNotFound();
    }
    const caso = await this.casosRepository.findDetailForMember(
      casoId,
      callerId,
    );
    if (!caso) {
      throw casoNotFound();
    }
    if (!estadosCasoNegociables.includes(caso.estado)) {
      throw casoNoNegociable(caso.estado);
    }
    return this.negociacionesRepository.crear(
      casoId,
      body.subject_type,
      caso.metodo,
    );
  }

  /**
   * The propuestas of one materia. The RN-05 gate reads that negociacion's own
   * round: with two materias open, tenencia reaching ronda 3 says nothing
   * about what the mediador may read of alimentos.
   */
  async listPropuestasForNegociacion(
    negociacionId: string,
    callerId: string,
  ): Promise<PropuestaDetail[]> {
    const negociacion =
      await this.negociacionesRepository.findById(negociacionId);
    if (!negociacion) {
      throw negociacionNotFound();
    }
    const membership = await this.membershipService.assertMembership(
      negociacion.caso_id,
      callerId,
    );
    if (
      membership.rol_en_caso === rolMediador &&
      negociacion.round < rn05MediadorDesdeRonda
    ) {
      throw negociacionNotFound();
    }
    return this.propuestasRepository.findDetailForNegociacion(
      negociacionId,
      callerId,
    );
  }

  /**
   * Reopens a signed materia. Addressed by negociacion, so the caso has to be
   * resolved before membership can be asserted at all; a caller who is not a
   * party gets the same 404 as a negociacion that does not exist. The mediador
   * is excluded the way `responder` excludes them: reopening a negotiation is
   * a party's act.
   */
  async renegociar(
    negociacionId: string,
    callerId: string,
  ): Promise<RenegociacionView> {
    const negociacion =
      await this.negociacionesRepository.findById(negociacionId);
    if (!negociacion) {
      throw negociacionNotFound();
    }
    const membership = await this.membershipService.assertMembership(
      negociacion.caso_id,
      callerId,
    );
    if (membership.rol_en_caso === rolMediador) {
      throw negociacionNotFound();
    }
    return this.negociacionesRepository.renegociar(negociacionId);
  }

  private async ensureActiveRonda(
    casoId: string,
    negociacionId: string,
    round: number,
  ): Promise<string> {
    const existing = await this.rondasRepository.findByNumero(
      negociacionId,
      round,
    );
    if (existing) {
      return existing.id;
    }
    const created = await this.rondasRepository.insertNextRonda(
      casoId,
      negociacionId,
      round,
    );
    return created.id;
  }

  private async completeGeneration(
    casoId: string,
    propuestaId: string,
    meetingPoint: MeetingPointEntry[],
    iaConfig: IaConfig,
  ): Promise<void> {
    const generated = await this.aiProposalGenerator.generateProposal({
      prompt: buildPrompt(meetingPoint),
      model: iaConfig.modelo,
      temperature: iaConfig.temperature,
      maxTokens: iaConfig.maxTokens,
    });
    const contenido: PropuestaContenido = {
      meetingPoint,
      narrative: generated.text,
    };
    await this.propuestasRepository.patchGenerated(
      casoId,
      propuestaId,
      contenido,
      generated.text,
    );
  }
}
