import type { Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { MembershipService } from "../casos/membership.service";
import { normalizeTimestamp } from "../common/db/timestamp";
import { buildCalendarEvent } from "./calendar-event";
import { buildTareasFromAcuerdo } from "./tarea-generation";
import { TareasRepository, tareaNotFound } from "./tareas.repository";
import type {
  CalendarEventDto,
  Tarea,
  TareaCalendarEvent,
  TareaView,
  UpdateTareaEstadoDto,
} from "./tareas.types";
import { estadosTarea } from "./tareas.types";

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function assertValidEstado(input: UpdateTareaEstadoDto): void {
  if (!estadosTarea.includes(input?.estado)) {
    throw invalidInput(`estado must be one of ${estadosTarea.join(", ")}`);
  }
}

function resolveFechaEvento(input: CalendarEventDto, tarea: Tarea): string {
  const candidate = input?.fecha_evento ?? tarea.fecha_evento;
  if (candidate === undefined || candidate === null || candidate === "") {
    throw invalidInput("fecha_evento is required");
  }
  const normalized = normalizeTimestamp(candidate);
  if (normalized === null) {
    throw invalidInput("fecha_evento must be a valid ISO date");
  }
  return normalized;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND
  );
}

@Injectable()
export class TareasService {
  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(TareasRepository)
    private readonly tareasRepository: TareasRepository,
  ) {}

  async listForCaso(casoId: string, callerId: string): Promise<TareaView[]> {
    await this.membershipService.assertMembership(casoId, callerId);
    return this.tareasRepository.listByCaso(casoId);
  }

  async updateEstado(
    tareaId: string,
    callerId: string,
    input: UpdateTareaEstadoDto,
  ): Promise<TareaView> {
    assertValidEstado(input);
    await this.loadAccessibleTarea(tareaId, callerId);
    return this.tareasRepository.updateEstado(tareaId, input.estado);
  }

  async addToCalendar(
    tareaId: string,
    callerId: string,
    input: CalendarEventDto,
  ): Promise<TareaCalendarEvent> {
    const tarea = await this.loadAccessibleTarea(tareaId, callerId);
    const fechaEvento = resolveFechaEvento(input, tarea);
    const scheduled = await this.tareasRepository.scheduleCalendarEvent(
      tareaId,
      fechaEvento,
    );
    const ics = buildCalendarEvent({
      id: scheduled.id,
      descripcion: scheduled.descripcion,
      fechaEvento: new Date(fechaEvento),
      generatedAt: new Date(),
    });
    return { tarea: scheduled, ics };
  }

  generateForAcuerdo(
    acuerdoId: string,
    casoId: string,
    contenido: Json,
  ): Promise<TareaView[]> {
    const generated = buildTareasFromAcuerdo(acuerdoId, casoId, contenido);
    return this.tareasRepository.insertGenerated(acuerdoId, generated);
  }

  private async loadAccessibleTarea(
    tareaId: string,
    callerId: string,
  ): Promise<Tarea> {
    const tarea = await this.tareasRepository.findById(tareaId);
    if (!tarea) {
      throw tareaNotFound();
    }
    try {
      await this.membershipService.assertMembership(tarea.caso_id, callerId);
    } catch (error: unknown) {
      if (isNotFound(error)) {
        throw tareaNotFound();
      }
      throw error;
    }
    return tarea;
  }
}
