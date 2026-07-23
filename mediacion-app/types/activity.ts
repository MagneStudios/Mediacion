import type { NoticeDestination } from './notice';

/**
 * Domain types for the read-only shared "Actividad del proceso" timeline.
 *
 * BACKEND ALIGNMENT: the closest backend table is `auditoria` — but that is
 * an internal admin/audit trace (`accion`, `entidad`, free-form `detalle`
 * jsonb), never intended as a user-facing feed. It is NOT mirrored or read
 * here. Every ActivityEventKey below is a frontend-only, curated,
 * already-shared-safe event vocabulary with no backend enum behind it.
 *
 * This feed contains only facts already safe to show BOTH parties — case
 * lifecycle and round/proposal/agreement/signature milestones already
 * surfaced elsewhere (round history, agreement history). It deliberately
 * excludes private-position readiness entirely: that is a personal notice
 * only (see types/notice.ts), never a shared activity event, and never
 * derived from positionsService/PositionItem here.
 */
export type ActivityEventKey =
  | 'case_created'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'negotiation_started'
  | 'proposal_ready'
  | 'own_response_registered'
  | 'round_completed'
  | 'agreement_reached'
  | 'signature_ready'
  | 'own_mock_signature_registered'
  | 'process_completed';

/**
 * Immutable after seeding — nothing in this feature ever mutates an
 * ActivityItem. `own_response_registered` describes only the authenticated
 * party's own action; it never reveals the other party's hidden response
 * before shared resolution.
 */
export interface ActivityItem {
  id: string;
  eventKey: ActivityEventKey;
  createdAt: string;
  caseId?: string;
  destination: NoticeDestination;
  params?: Record<string, string | number>;
}

/** Read-time projection returned by activityService.listActivity() — caseTitle resolved via the public cases-service accessor, same pattern as NoticeListItem. */
export type ActivityListItem = ActivityItem & { caseTitle?: string };
