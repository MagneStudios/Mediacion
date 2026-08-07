import type {
  AppNotice,
  NoticeCategory,
  NoticeDestination,
  NoticePriority,
} from '@/types/notice';

/**
 * `GET /notificaciones` (apps/api/src/notificaciones/avisos.controller.ts).
 *
 * `estado` is a DELIVERY status (pendiente/enviada/fallida) and says nothing
 * about whether the user read the notice — that is `leido_at`, which is null
 * while unread.
 */
export type ApiNotificacion = {
  id: string;
  caso_id: string | null;
  canal: 'email' | 'push';
  evento: string;
  estado: 'pendiente' | 'enviada' | 'fallida';
  fecha: string | null;
  created_at: string;
  leido_at: string | null;
};

type Presentation = {
  category: NoticeCategory;
  titleKey: string;
  bodyKey: string;
  priority: NoticePriority;
  destinationType: 'case' | 'none';
};

/**
 * `evento` is free text in the schema with no enum, so this is an allow-list
 * rather than an exhaustive map. Today the API emits exactly two events —
 * `invitacion_enviada` (invitaciones.service.ts) and `vencimiento`
 * (vencimiento.scheduler.ts). Anything else is rendered through the generic
 * fallback instead of being dropped: a notice the user cannot read is worse
 * than one with plain wording, and silently discarding server rows would hide
 * real activity.
 */
const presentationByEvento: Record<string, Presentation> = {
  invitacion_enviada: {
    category: 'invitation',
    titleKey: 'notices.events.invitacionEnviada.title',
    bodyKey: 'notices.events.invitacionEnviada.body',
    priority: 'normal',
    destinationType: 'case',
  },
  vencimiento: {
    category: 'deadline',
    titleKey: 'notices.events.vencimiento.title',
    bodyKey: 'notices.events.vencimiento.body',
    priority: 'important',
    destinationType: 'case',
  },
};

const fallbackPresentation: Presentation = {
  category: 'system',
  titleKey: 'notices.events.generic.title',
  bodyKey: 'notices.events.generic.body',
  priority: 'normal',
  destinationType: 'case',
};

export function toPresentation(evento: string): Presentation {
  return presentationByEvento[evento] ?? fallbackPresentation;
}

/**
 * A destination is only ever built from a caso_id the server sent. A notice
 * with no caso_id resolves to `none` rather than to a route with a missing
 * segment.
 */
function toDestination(
  destinationType: Presentation['destinationType'],
  casoId: string | null,
): NoticeDestination {
  if (destinationType === 'none' || casoId === null) {
    return { type: 'none' };
  }
  return { type: 'case', caseId: casoId };
}

export function toAppNotice(row: ApiNotificacion): AppNotice {
  const presentation = toPresentation(row.evento);
  return {
    id: row.id,
    category: presentation.category,
    titleKey: presentation.titleKey,
    bodyKey: presentation.bodyKey,
    createdAt: row.created_at,
    read: row.leido_at !== null,
    priority: presentation.priority,
    destination: toDestination(presentation.destinationType, row.caso_id),
    ...(row.caso_id === null ? {} : { caseId: row.caso_id }),
  };
}
