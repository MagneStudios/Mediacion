import i18n from '../i18n';
import type { DecisionPropuesta, NegotiationRound, SharedProposal } from '../types/negotiation';

/**
 * Deterministic simulated-counterparty decision matrix, by caseId and round
 * number. `null` means the simulated party never responds in this session —
 * used deliberately to demonstrate the "waiting for the other party" state
 * as a real, reachable dead end for exactly one demo case. Anything not
 * listed here falls through to a resolvable default so later rounds (e.g.
 * case-1 round 4+) stay playable instead of becoming new dead ends.
 *
 * No randomness — tests and manual walkthroughs must be repeatable.
 * Contains only decisions, never counterparty positions, reasons, ranges, or
 * conditions.
 */
const COUNTERPARTY_DECISION_MATRIX: Record<string, Record<number, DecisionPropuesta | null>> = {
  // Rejection + round-3 path: rounds 1 and 2 both resolve without
  // agreement, so round 3 (and the mediator-availability card) is reachable
  // without waiting forever.
  'case-1': { 1: 'rechaza', 2: 'rechaza' },
  // Waiting path: the simulated party never answers round 1.
  'case-2': { 1: null },
  // Agreement path: already resolved via the seeded historical round below.
  'case-3': { 1: 'acepta' },
};
const DEFAULT_COUNTERPARTY_DECISION: DecisionPropuesta = 'acepta';

export function simulatedCounterpartyDecision(caseId: string, roundNumber: number): DecisionPropuesta | null {
  const forCase = COUNTERPARTY_DECISION_MATRIX[caseId];
  if (forCase && roundNumber in forCase) return forCase[roundNumber];
  return DEFAULT_COUNTERPARTY_DECISION;
}

/** Internal-only boolean — never exposed to the UI as anything richer than the derived NegotiationEligibility value. */
const COUNTERPARTY_READY: Record<string, boolean> = {
  'case-1': true,
  'case-2': true,
  'case-3': true,
};

export function isCounterpartyReady(caseId: string): boolean {
  return COUNTERPARTY_READY[caseId] ?? true;
}

type ProposalFixture = {
  title: string;
  summary: string;
  terms: { title: string; description: string }[];
  rationale?: string;
};

/**
 * PRIVACY BOUNDARY: every fixture below is predetermined shared content,
 * selected only by caseId + round number + active language. Real proposal
 * synthesis — reading each party's private ranges and conditions to find a
 * sanitized middle ground — is backend work; this mock never reads a
 * PositionItem and never interpolates a private value into this content.
 */
const PROPOSAL_FIXTURES: Record<string, Record<number, Record<'es-AR' | 'en', ProposalFixture>>> = {
  'case-1': {
    2: {
      'es-AR': {
        title: 'Calendario alterno de cuidado',
        summary: 'Una propuesta de organización semanal alternada, con foco en la estabilidad de los chicos.',
        terms: [
          { title: 'Semanas alternas', description: 'Cada parte tiene a cargo el cuidado durante semanas completas, alternadas.' },
          { title: 'Entrega los viernes', description: 'El cambio se realiza los viernes por la tarde en el centro escolar.' },
        ],
        rationale: 'Prioriza la continuidad escolar y reduce las transiciones a mitad de semana.',
      },
      en: {
        title: 'Alternating care calendar',
        summary: 'A weekly alternating arrangement, focused on keeping routines stable for the kids.',
        terms: [
          { title: 'Alternating weeks', description: 'Each party has full-week care, on alternating weeks.' },
          { title: 'Friday handoff', description: 'The handoff happens Friday afternoon at school.' },
        ],
        rationale: 'Prioritizes school continuity and reduces mid-week transitions.',
      },
    },
    3: {
      'es-AR': {
        title: 'Esquema mixto con revisión semestral',
        summary: 'Una alternativa con revisión periódica para ajustar el esquema según cómo funcione en la práctica.',
        terms: [
          { title: 'Prueba de seis meses', description: 'El esquema se prueba durante seis meses antes de confirmarse.' },
          { title: 'Revisión conjunta', description: 'Ambas partes revisan el resultado y pueden ajustar detalles.' },
        ],
        rationale: 'Permite avanzar sin cerrar todos los detalles de forma definitiva.',
      },
      en: {
        title: 'Mixed schedule with a six-month review',
        summary: 'An alternative with a periodic review to adjust the arrangement based on how it works in practice.',
        terms: [
          { title: 'Six-month trial', description: 'The arrangement is tried for six months before being confirmed.' },
          { title: 'Joint review', description: 'Both parties review the outcome and can adjust details.' },
        ],
        rationale: 'Allows moving forward without locking in every detail permanently.',
      },
    },
  },
  'case-2': {
    1: {
      'es-AR': {
        title: 'Reparto de bienes por categorías',
        summary: 'Una división de bienes organizada por tipo, buscando un equilibrio general.',
        terms: [
          { title: 'División por categoría', description: 'Los bienes se agrupan por tipo y se reparten según su naturaleza.' },
          { title: 'Tasación neutral', description: 'Los bienes de mayor valor se tasan de forma independiente antes del reparto.' },
        ],
        rationale: 'Busca un reparto equilibrado sin necesidad de vender bienes en común.',
      },
      en: {
        title: 'Asset split by category',
        summary: 'A division of assets organized by type, aiming for overall balance.',
        terms: [
          { title: 'Split by category', description: 'Assets are grouped by type and divided according to their nature.' },
          { title: 'Neutral appraisal', description: 'Higher-value assets are appraised independently before splitting.' },
        ],
        rationale: 'Aims for a balanced split without needing to sell shared assets.',
      },
    },
  },
  'case-3': {
    1: {
      'es-AR': {
        title: 'Cuota de alimentos acordada',
        summary: 'Un esquema de aportes mensuales con actualización periódica.',
        terms: [
          { title: 'Aporte mensual fijo', description: 'Se define un monto mensual con fecha de pago acordada.' },
          { title: 'Actualización anual', description: 'El monto se actualiza una vez al año según un índice de referencia.' },
        ],
        rationale: 'Da previsibilidad a ambas partes durante todo el año.',
      },
      en: {
        title: 'Agreed support payment',
        summary: 'A monthly contribution arrangement with periodic updates.',
        terms: [
          { title: 'Fixed monthly contribution', description: 'A monthly amount is set with an agreed payment date.' },
          { title: 'Annual update', description: 'The amount is updated once a year based on a reference index.' },
        ],
        rationale: 'Gives both parties predictability throughout the year.',
      },
    },
  },
};

/** Falls back to a generic sanitized fixture for rounds beyond the seeded matrix, so play can continue without a real backend. */
const GENERIC_FIXTURE: Record<'es-AR' | 'en', ProposalFixture> = {
  'es-AR': {
    title: 'Propuesta compartida',
    summary: 'Una alternativa intermedia elaborada a partir de la información disponible en este caso.',
    terms: [{ title: 'Punto de encuentro', description: 'Un esquema que busca acercar ambas posiciones sin exponer los valores originales.' }],
    rationale: 'Generada como punto de partida para seguir la conversación.',
  },
  en: {
    title: 'Shared proposal',
    summary: 'A middle-ground alternative built from the information available in this case.',
    terms: [{ title: 'Common ground', description: "An arrangement that tries to bring both positions closer without exposing original values." }],
    rationale: 'Generated as a starting point to continue the conversation.',
  },
};

function currentLanguage(): 'es-AR' | 'en' {
  return i18n.language === 'en' ? 'en' : 'es-AR';
}

export function getProposalFixture(caseId: string, roundNumber: number): ProposalFixture {
  const lang = currentLanguage();
  return PROPOSAL_FIXTURES[caseId]?.[roundNumber]?.[lang] ?? GENERIC_FIXTURE[lang];
}

/** Seeded rounds for the three demo cases — the initial in-memory state, mutated only through negotiation.service.ts from here on. */
export function buildInitialRounds(): NegotiationRound[] {
  return [
    {
      id: 'round-case-1-1',
      caseId: 'case-1',
      number: 1,
      estado: 'completada',
      proposalId: 'proposal-case-1-1',
      mediatorAvailable: false,
      createdAt: '2026-06-10T14:00:00.000Z',
      completedAt: '2026-06-17T09:30:00.000Z',
    },
    {
      id: 'round-case-1-2',
      caseId: 'case-1',
      number: 2,
      estado: 'activa',
      proposalId: undefined,
      mediatorAvailable: false,
      createdAt: '2026-06-17T09:30:00.000Z',
    },
    {
      id: 'round-case-2-1',
      caseId: 'case-2',
      number: 1,
      estado: 'activa',
      proposalId: 'proposal-case-2-1',
      mediatorAvailable: false,
      createdAt: '2026-07-01T11:00:00.000Z',
    },
    {
      id: 'round-case-3-1',
      caseId: 'case-3',
      number: 1,
      estado: 'completada',
      proposalId: 'proposal-case-3-1',
      mediatorAvailable: false,
      createdAt: '2026-05-20T10:00:00.000Z',
      completedAt: '2026-05-28T16:45:00.000Z',
    },
  ];
}

/** Seeded proposals matching buildInitialRounds() — content is sanitized shared fixture data, see PROPOSAL_FIXTURES above. */
export function buildInitialProposals(): SharedProposal[] {
  return [
    {
      id: 'proposal-case-1-1',
      caseId: 'case-1',
      roundId: 'round-case-1-1',
      roundNumber: 1,
      title: 'Cronograma semanal de cuidado',
      summary: 'Una alternancia semanal simple, sin definir todavía un esquema de vacaciones.',
      terms: [
        { id: 'proposal-case-1-1-term-1', title: 'Semanas alternas', description: 'Cuidado alternado en bloques semanales.' },
      ],
      rationale: 'Primer punto de partida antes de ajustar detalles de vacaciones y feriados.',
      estado: 'rechazada',
      createdAt: '2026-06-10T14:05:00.000Z',
    },
    {
      id: 'proposal-case-2-1',
      caseId: 'case-2',
      roundId: 'round-case-2-1',
      roundNumber: 1,
      title: PROPOSAL_FIXTURES['case-2'][1]['es-AR'].title,
      summary: PROPOSAL_FIXTURES['case-2'][1]['es-AR'].summary,
      terms: PROPOSAL_FIXTURES['case-2'][1]['es-AR'].terms.map((term, index) => ({
        id: `proposal-case-2-1-term-${index}`,
        ...term,
      })),
      rationale: PROPOSAL_FIXTURES['case-2'][1]['es-AR'].rationale,
      estado: 'pendiente',
      createdAt: '2026-07-01T11:05:00.000Z',
    },
    {
      id: 'proposal-case-3-1',
      caseId: 'case-3',
      roundId: 'round-case-3-1',
      roundNumber: 1,
      title: PROPOSAL_FIXTURES['case-3'][1]['es-AR'].title,
      summary: PROPOSAL_FIXTURES['case-3'][1]['es-AR'].summary,
      terms: PROPOSAL_FIXTURES['case-3'][1]['es-AR'].terms.map((term, index) => ({
        id: `proposal-case-3-1-term-${index}`,
        ...term,
      })),
      rationale: PROPOSAL_FIXTURES['case-3'][1]['es-AR'].rationale,
      estado: 'aceptada',
      createdAt: '2026-05-20T10:05:00.000Z',
    },
  ];
}
