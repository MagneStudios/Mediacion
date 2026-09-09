/**
 * Domain types for post-agreement tasks (`tareas` — RN-14 "accionables").
 *
 * **Where these come from matters for reading any empty list.** Nothing in the
 * app creates a task. They are generated server-side, once, by the DocuSign
 * webhook when every signature on an agreement completes
 * (`acuerdos/webhook/docusign-webhook.service.ts` → `generateForAcuerdo`), one
 * per category of the accepted meeting point. With the eight `DOCUSIGN_*`
 * variables unset the webhook never fires, so `GET /casos/:casoId/tareas`
 * answers `[]` — an empty list is the expected state today, not a failure.
 */

/** Matches the `estado_tarea` enum exactly. */
export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada';

/**
 * Matches the `tipo_tarea` enum. A task becomes `evento_calendario` only by
 * going through `POST /tareas/:id/calendario`; everything the generator
 * produces is `tarea`.
 */
export type TipoTarea = 'tarea' | 'evento_calendario';

export type Task = {
  id: string;
  caseId: string;
  agreementId: string;
  tipo: TipoTarea;
  description: string;
  /**
   * `null` for every generated task, and **that is every task today**: the
   * generator never sets a date, and the only endpoint that can set one
   * requires one to be sent. See `docs/pedidos-frontend-a-backend.md` §11.
   */
  eventDate: string | null;
  estado: EstadoTarea;
  createdAt: string;
};
