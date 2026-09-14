import type { AgreementHistoryItem, SharedAgreement, SharedSignerStatus } from '../types/agreement';

/**
 * Pre-seeded, already-fully-signed agreement — case-3's historical
 * backstory. Sanitized shared content only, copied at the time from
 * proposal-case-3-1 (see mocks/negotiation.ts) — the same privacy boundary
 * documented in agreements.service.ts applies to this fixture too: no
 * private position values, no per-party attribution.
 */
export function buildInitialAgreements(): SharedAgreement[] {
  return [
    {
      id: 'agreement-case-3-1',
      caseId: 'case-3',
      sourceProposalId: 'proposal-case-3-1',
      sourceRoundNumber: 1,
      title: 'Cuota de alimentos acordada',
      summary: 'Un esquema de aportes mensuales con actualización periódica.',
      terms: [
        {
          id: 'agreement-case-3-1-term-0',
          title: 'Aporte mensual fijo',
          description: 'Se define un monto mensual con fecha de pago acordada.',
        },
        {
          id: 'agreement-case-3-1-term-1',
          title: 'Actualización anual',
          description: 'El monto se actualiza una vez al año según un índice de referencia.',
        },
      ],
      rationale: 'Da previsibilidad a ambas partes durante todo el año.',
      estado: 'firmado',
      createdAt: '2026-05-28T17:00:00.000Z',
      readyAt: '2026-05-28T17:10:00.000Z',
      completedAt: '2026-05-29T12:00:00.000Z',
    },
  ];
}

export function buildInitialSigners(): Record<string, SharedSignerStatus[]> {
  return {
    'agreement-case-3-1': [
      { role: 'authenticated_party', status: 'firmado', signedAt: '2026-05-28T18:00:00.000Z' },
      { role: 'other_party', status: 'firmado', signedAt: '2026-05-29T12:00:00.000Z' },
    ],
  };
}

export function buildInitialHistory(): Record<string, AgreementHistoryItem[]> {
  return {
    'agreement-case-3-1': [
      { id: 'agreement-case-3-1-hist-0', eventKey: 'agreement_created', timestamp: '2026-05-28T17:00:00.000Z', status: 'borrador' },
      { id: 'agreement-case-3-1-hist-1', eventKey: 'preparation_started', timestamp: '2026-05-28T17:05:00.000Z', status: 'borrador' },
      { id: 'agreement-case-3-1-hist-2', eventKey: 'document_ready', timestamp: '2026-05-28T17:10:00.000Z', status: 'enviado_a_firma' },
      { id: 'agreement-case-3-1-hist-3', eventKey: 'own_signature_registered', timestamp: '2026-05-28T18:00:00.000Z', status: 'enviado_a_firma' },
      { id: 'agreement-case-3-1-hist-4', eventKey: 'waiting_for_other_party', timestamp: '2026-05-28T18:00:01.000Z', status: 'enviado_a_firma' },
      { id: 'agreement-case-3-1-hist-5', eventKey: 'both_signatures_completed', timestamp: '2026-05-29T12:00:00.000Z', status: 'firmado' },
    ],
  };
}
