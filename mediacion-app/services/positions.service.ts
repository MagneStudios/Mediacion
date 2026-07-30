import { mockCaseDetails } from '../mocks/cases';
import type { CreatePositionInput, PositionItem, UpdatePositionInput } from '../types/position';
import { generateMockPositionId } from '../utils/mock-id';
import { getPositionEligibility } from '../utils/position-eligibility';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { backend } from './backend-instance';

/**
 * Replaceable service boundary for a party's own private position items.
 * Scoped deliberately to "own" — there is no getAllPositions,
 * getCounterpartyPositions, comparePositions, or raw shared-position method
 * here, and there never should be; RN-01 (absolute position isolation) is a
 * backend rule this mock already respects by construction.
 *
 * Every lookup and mutation validates caseId + the current mock owner +
 * item ownership + case eligibility independently of whatever the UI
 * already gated — the UI hiding a button is not the enforcement boundary.
 */
export type PositionsService = {
  getOwnPositions(caseId: string): Promise<PositionItem[]>;
  getOwnPosition(caseId: string, positionId: string): Promise<PositionItem | null>;
  createOwnPosition(input: CreatePositionInput): Promise<PositionItem>;
  updateOwnPosition(input: UpdatePositionInput): Promise<PositionItem>;
  deleteOwnPosition(caseId: string, positionId: string): Promise<void>;
};

/** One stable mock authenticated party for the whole frontend session — never chosen by the user, never exposed in the UI. */
const MOCK_OWNER_ID = 'party-self';

/** In-memory only — cleared on app restart, never written to disk, never logged. */
const mockPositions: PositionItem[] = [];

const failures = createFailureController<'createOwnPosition' | 'updateOwnPosition' | 'deleteOwnPosition'>();

export function __mockForcePositionFailure(
  operation: 'createOwnPosition' | 'updateOwnPosition' | 'deleteOwnPosition',
): void {
  failures.force(operation);
}

function findOwnedIndex(caseId: string, positionId: string): number {
  return mockPositions.findIndex(
    (item) => item.id === positionId && item.caseId === caseId && item.ownerId === MOCK_OWNER_ID,
  );
}

function caseEligibleFor(caseId: string, action: 'write'): boolean {
  const detail = mockCaseDetails[caseId];
  if (!detail) return false;
  const eligibility = getPositionEligibility(detail.estado);
  return action === 'write' ? eligibility === 'editable' : eligibility !== 'ineligible';
}

export function createMockPositionsService(): PositionsService {
  return {
    // Reads intentionally carry no eligibility gate: every case state that
    // can hold items ('activo' | 'en_negociacion' | 'acordado') must allow
    // viewing them (acordado is explicitly read-only, not read-blocked), and
    // a 'nuevo' case can never have items in the first place since writes
    // are eligibility-gated below — so it always resolves to caseId +
    // ownership filtering only.
    async getOwnPositions(caseId) {
      const items = mockPositions.filter((item) => item.caseId === caseId && item.ownerId === MOCK_OWNER_ID);
      return delay(items, 500);
    },

    async getOwnPosition(caseId, positionId) {
      const index = findOwnedIndex(caseId, positionId);
      return delay(index === -1 ? null : mockPositions[index], 300);
    },

    async createOwnPosition(input) {
      if (failures.consume('createOwnPosition')) {
        return rejectAfter('mock_create_position_failed', 500);
      }
      if (!caseEligibleFor(input.caseId, 'write')) {
        return rejectAfter('position_case_not_editable', 300);
      }

      const now = new Date().toISOString();
      const item: PositionItem = {
        id: generateMockPositionId(),
        caseId: input.caseId,
        ownerId: MOCK_OWNER_ID,
        category: input.category,
        name: input.name,
        description: input.description,
        valueMin: input.valueMin,
        valueMax: input.valueMax,
        canConcede: input.canConcede,
        concessionConditions: input.canConcede ? input.concessionConditions : undefined,
        private: true,
        createdAt: now,
        updatedAt: now,
      };

      const created = await delay(item, 800);
      mockPositions.push(created);
      return created;
    },

    async updateOwnPosition(input) {
      if (failures.consume('updateOwnPosition')) {
        return rejectAfter('mock_update_position_failed', 500);
      }
      if (!caseEligibleFor(input.caseId, 'write')) {
        return rejectAfter('position_case_not_editable', 300);
      }

      const index = findOwnedIndex(input.caseId, input.id);
      if (index === -1) {
        return rejectAfter('position_not_found', 300);
      }

      // Only the editable fields below may change — caseId, ownerId, id,
      // private, and createdAt are carried over from the existing record,
      // never taken from the input.
      const existing = mockPositions[index];
      const updated: PositionItem = {
        ...existing,
        category: input.category,
        name: input.name,
        description: input.description,
        valueMin: input.valueMin,
        valueMax: input.valueMax,
        canConcede: input.canConcede,
        concessionConditions: input.canConcede ? input.concessionConditions : undefined,
        updatedAt: new Date().toISOString(),
      };

      const saved = await delay(updated, 700);
      mockPositions[index] = saved;
      return saved;
    },

    async deleteOwnPosition(caseId, positionId) {
      if (failures.consume('deleteOwnPosition')) {
        return rejectAfter('mock_delete_position_failed', 500);
      }
      if (!caseEligibleFor(caseId, 'write')) {
        return rejectAfter('position_case_not_editable', 300);
      }

      const index = findOwnedIndex(caseId, positionId);
      if (index === -1) {
        return rejectAfter('position_not_found', 300);
      }

      await delay(undefined, 500);
      mockPositions.splice(index, 1);
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
// The real service implements PositionsService member for member, so it is
// swapped in directly with no adapter.
export const positionsService: PositionsService = backend
  ? backend.positions
  : createMockPositionsService();
