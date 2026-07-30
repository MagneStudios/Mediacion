import { Inject, Injectable } from "@nestjs/common";
import { AcuerdoAccessService } from "../acuerdos/acuerdo-access.service";
import {
  AcuerdosRepository,
  acuerdoNotFound,
} from "../acuerdos/acuerdos.repository";
import { MembershipService } from "../casos/membership.service";
import { normalizeTimestamp } from "../common/db/timestamp";
import { ActividadRepository } from "./actividad.repository";
import type { ActivityEvent } from "./actividad.types";

const defaultLimit = 100;

@Injectable()
export class ActividadService {
  constructor(
    @Inject(ActividadRepository)
    private readonly actividadRepository: ActividadRepository,
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(AcuerdosRepository)
    private readonly acuerdosRepository: AcuerdosRepository,
    @Inject(AcuerdoAccessService)
    private readonly acuerdoAccessService: AcuerdoAccessService,
  ) {}

  async listForCaso(
    casoId: string,
    callerId: string,
  ): Promise<ActivityEvent[]> {
    await this.membershipService.assertMembership(casoId, callerId);
    const events = await this.actividadRepository.listForCaso(
      casoId,
      defaultLimit,
    );
    return events.map(normalize);
  }

  /**
   * The acuerdo is resolved first so access is checked against its caso, not
   * against an id the caller supplied — otherwise a stranger's acuerdo id would
   * return its history.
   */
  async listForAcuerdo(
    acuerdoId: string,
    callerId: string,
  ): Promise<ActivityEvent[]> {
    const acuerdo = await this.acuerdosRepository.findById(acuerdoId);
    if (!acuerdo) {
      throw acuerdoNotFound();
    }
    await this.acuerdoAccessService.assertReadAccess(acuerdo.caso_id, callerId);
    const events = await this.actividadRepository.listForAcuerdo(
      acuerdoId,
      defaultLimit,
    );
    return events.map(normalize);
  }
}

function normalize(event: ActivityEvent): ActivityEvent {
  return {
    ...event,
    created_at: normalizeTimestamp(event.created_at) ?? event.created_at,
  };
}
