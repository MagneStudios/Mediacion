import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { CasosRepository } from "../casos/casos.repository";
import { MembershipService } from "../casos/membership.service";
import type { AiProposalGenerator } from "./ai/ai-proposal-generator";
import { AI_PROPOSAL_GENERATOR } from "./ai/ai-proposal-generator";
import { ConfiguracionRepository } from "./configuracion.repository";
import type { MeetingPointEntry, PositionInput } from "./meeting-point";
import { computeMeetingPoints } from "./meeting-point";
import type {
  DecisionPropuesta,
  IaConfig,
  PropuestaContenido,
  PropuestaView,
} from "./negociacion.types";
import type { EnginePosition } from "./propuestas.repository";
import { PropuestasRepository } from "./propuestas.repository";
import { RondasRepository } from "./rondas.repository";

const rolMediador = "mediador" as const;
const rn05MediadorDesdeRonda = 3;
const validDecisiones: DecisionPropuesta[] = ["acepta", "rechaza"];

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

function casoNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
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
  ) {}

  async generatePropuesta(
    casoId: string,
    callerId: string,
  ): Promise<PropuestaView> {
    await this.membershipService.assertMembership(casoId, callerId);
    const positions =
      await this.propuestasRepository.readBothPartyPositionsForEngine(casoId);
    const [positionsA, positionsB] = assertBothPartiesSubmitted(positions);
    await this.casosRepository.activateNegotiation(casoId);
    const rondaId = await this.ensureActiveRondaId(casoId);
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
  ): Promise<PropuestaView[]> {
    const membership = await this.membershipService.assertMembership(
      casoId,
      callerId,
    );
    if (membership.rol_en_caso === rolMediador) {
      const rondaActual =
        await this.rondasRepository.currentRondaActual(casoId);
      if (rondaActual === undefined || rondaActual < rn05MediadorDesdeRonda) {
        throw casoNotFound();
      }
    }
    return this.propuestasRepository.findForCase(casoId);
  }

  private async ensureActiveRondaId(casoId: string): Promise<string> {
    const numero = await this.rondasRepository.currentRondaActual(casoId);
    if (numero === undefined) {
      throw new Error(
        `Caso ${casoId} not found while resolving ronda_actual after membership was already asserted`,
      );
    }
    const existing = await this.rondasRepository.findByNumero(casoId, numero);
    if (existing) {
      return existing.id;
    }
    const created = await this.rondasRepository.insertNextRonda(casoId, numero);
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
