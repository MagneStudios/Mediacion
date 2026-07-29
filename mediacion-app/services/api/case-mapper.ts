import type {
  CaseDetail,
  CaseStatusLabelKey,
  CaseSummary,
  CaseVisualStatus,
  EstadoCaso,
  MetodoCaso,
} from '@/types/case';

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

export type ApiContraparte = {
  usuario_id: string;
  rol_en_caso: string;
  nombre: string;
  apellido: string;
};

export type ApiCaseSummary = {
  id: string;
  nombre: string;
  estado: EstadoCaso;
  metodo: MetodoCaso;
  created_at: string;
  plazo: string | null;
  sla_tipo: string | null;
  ronda_actual: number;
  semaforo: Semaforo | null;
  contraparte: ApiContraparte | null;
};

export type ApiCaseDetail = ApiCaseSummary & {
  descripcion: string | null;
  creador_id: string;
  updated_at: string;
};

const millisecondsPerHour = 60 * 60 * 1000;

const visualStatusBySemaforo: Record<Semaforo, CaseVisualStatus> = {
  verde: 'success',
  amarillo: 'warning',
  rojo: 'error',
};

/** No plazo means no deadline to show — not a healthy one. */
export function toVisualStatus(semaforo: Semaforo | null): CaseVisualStatus {
  return semaforo === null ? 'neutral' : visualStatusBySemaforo[semaforo];
}

/**
 * Hours left before the plazo, floored, never negative: an overdue case reads
 * as 0 hours remaining rather than as a negative countdown.
 */
export function toSlaHours(plazo: string | null, now: Date): number | null {
  if (plazo === null) {
    return null;
  }
  const deadline = new Date(plazo).getTime();
  if (Number.isNaN(deadline)) {
    return null;
  }
  return Math.max(0, Math.floor((deadline - now.getTime()) / millisecondsPerHour));
}

/**
 * What the party needs to know next, which is not a 1:1 mirror of `estado`:
 * a case nobody has joined is waiting on the counterparty regardless of the
 * round it is nominally in.
 */
export function toStatusLabelKey(
  estado: EstadoCaso,
  hasCounterparty: boolean,
): CaseStatusLabelKey {
  if (!hasCounterparty) {
    return 'awaitingCounterparty';
  }
  if (estado === 'acordado' || estado === 'cerrado' || estado === 'terminado') {
    return 'signed';
  }
  if (estado === 'en_negociacion') {
    return 'proposalReady';
  }
  return 'inReview';
}

export function toCounterpartyName(contraparte: ApiContraparte | null): string | null {
  if (contraparte === null) {
    return null;
  }
  return `${contraparte.nombre} ${contraparte.apellido}`.trim();
}

export function toCaseSummary(row: ApiCaseSummary, now: Date): CaseSummary {
  return {
    id: row.id,
    title: row.nombre,
    counterpartyName: toCounterpartyName(row.contraparte),
    estado: row.estado,
    metodo: row.metodo,
    roundNumber: row.ronda_actual,
    visualStatus: toVisualStatus(row.semaforo),
    statusLabelKey: toStatusLabelKey(row.estado, row.contraparte !== null),
    slaHours: toSlaHours(row.plazo, now),
  };
}

/**
 * `caseCode` has no column behind it; the API never invented one. It is derived
 * from the real id so two clients rendering the same case always show the same
 * code, instead of each fabricating its own.
 */
export function toCaseCode(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const suffix = id.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `CASO-${Number.isNaN(year) ? '0000' : year}-${suffix}`;
}

export function toCaseDetail(row: ApiCaseDetail, now: Date): CaseDetail {
  return {
    ...toCaseSummary(row, now),
    caseCode: toCaseCode(row.id, row.created_at),
    descripcion: row.descripcion ?? undefined,
  };
}
