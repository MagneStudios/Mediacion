import type { CaseDetail, CaseSummary } from '../types/case';

/**
 * Typed mock data for phase 1. Deliberately contains no private positions,
 * ranges, or concession conditions — only the same neutral, shared-state
 * information a real case list would ever show a party about their own
 * cases (never the counterparty's private figures).
 */
export const mockCases: CaseSummary[] = [
  {
    id: 'case-1',
    title: 'Custodia compartida',
    counterpartyName: 'Marco D.',
    estado: 'en_negociacion',
    metodo: 'mediacion',
    roundNumber: 2,
    visualStatus: 'info',
    statusLabelKey: 'inReview',
    slaHours: 36,
  },
  {
    id: 'case-2',
    title: 'Reparto de bienes',
    counterpartyName: 'Marco D.',
    estado: 'en_negociacion',
    metodo: 'negociacion',
    roundNumber: 1,
    visualStatus: 'ai',
    statusLabelKey: 'proposalReady',
    slaHours: null,
  },
  {
    id: 'case-3',
    title: 'Pensión de alimentos',
    counterpartyName: 'Marco D.',
    estado: 'acordado',
    metodo: 'conciliacion',
    roundNumber: null,
    visualStatus: 'success',
    statusLabelKey: 'signed',
    slaHours: null,
  },
];

export const mockCaseDetails: Record<string, CaseDetail> = {
  'case-1': {
    ...mockCases[0],
    caseCode: 'CASO-2026-0431',
  },
  'case-2': {
    ...mockCases[1],
    caseCode: 'CASO-2026-0512',
  },
  'case-3': {
    ...mockCases[2],
    caseCode: 'CASO-2026-0287',
  },
};
