import type { CaseDetail, CaseInvitation, CaseSummary } from '@/types/case';

import { createBackedCasesService } from '../cases.backed-service';
import type { ApiCasesService } from '../cases.api-service';

const summary = { id: 'caso-1', title: 'Custodia' } as CaseSummary;
const detail = { id: 'caso-1', title: 'Custodia', estado: 'nuevo' } as CaseDetail;
const activeDetail = { ...detail, estado: 'activo' } as CaseDetail;

function stubApi(overrides: Partial<ApiCasesService> = {}): ApiCasesService {
  return {
    listCases: async () => [summary],
    getCaseDetail: async () => detail,
    createCase: async () => summary,
    createInvitation: async () =>
      ({
        id: 'inv-1',
        caseId: 'caso-1',
        tipo: 'email',
        token: 'tok',
        emailDestino: null,
        estado: 'pendiente',
        pagoACargo: 'invitador',
        createdAt: '2026-07-30T00:00:00.000Z',
      }) as CaseInvitation,
    listInvitations: async () => [],
    getCaseTitle: async () => 'Custodia',
    joinCase: async () => ({ id: 'caso-1', estado: 'activo', requiresPayment: false }),
    ...overrides,
  };
}

/** As `listInvitations` hands them over: mapped, newest first, pagoACargo null. */
function serverInvitation(overrides: Partial<CaseInvitation> = {}): CaseInvitation {
  return {
    id: 'inv-1',
    caseId: 'caso-1',
    tipo: 'codigo',
    token: 'ABC123',
    emailDestino: null,
    estado: 'pendiente',
    pagoACargo: null,
    createdAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('createBackedCasesService', () => {
  it('passes the shared reads straight through', async () => {
    const service = createBackedCasesService(stubApi());
    await expect(service.listCases()).resolves.toEqual([summary]);
    await expect(service.getCaseDetail('caso-1')).resolves.toEqual(detail);
    await expect(service.getCaseTitle('caso-1')).resolves.toBe('Custodia');
  });

  describe('getInvitation', () => {
    // Reads `GET /casos/:id/invitaciones`. The session map is no longer the
    // source of the invitation — only of `pagoACargo`, the one field that
    // endpoint does not return.
    it('reads the code from the server, so a reload no longer loses it', async () => {
      // The regression this integration exists to kill: no createInvitation
      // call in this session, and the code still comes back.
      const listInvitations = jest.fn(async () => [serverInvitation()]);
      const service = createBackedCasesService(stubApi({ listInvitations }));

      await expect(service.getInvitation('caso-1')).resolves.toMatchObject({
        id: 'inv-1',
        token: 'ABC123',
      });
      expect(listInvitations).toHaveBeenCalledWith('caso-1');
    });

    it('is null when the caso has no invitation at all', async () => {
      const service = createBackedCasesService(stubApi());
      await expect(service.getInvitation('caso-1')).resolves.toBeNull();
    });

    it('takes the newest pending one, skipping the ones that cannot be used to join', async () => {
      // `listInvitations` hands them over newest first; an accepted, rejected
      // or expired token would send the counterparty into a dead end.
      const service = createBackedCasesService(
        stubApi({
          listInvitations: async () => [
            serverInvitation({ id: 'inv-3', estado: 'expirada', token: 'DEAD-3' }),
            serverInvitation({ id: 'inv-2', estado: 'pendiente', token: 'LIVE-2' }),
            serverInvitation({ id: 'inv-1', estado: 'pendiente', token: 'OLD-1' }),
          ],
        }),
      );

      await expect(service.getInvitation('caso-1')).resolves.toMatchObject({
        id: 'inv-2',
        token: 'LIVE-2',
      });
    });

    it('is null when every invitation is spent, rather than offering a dead token', async () => {
      const service = createBackedCasesService(
        stubApi({
          listInvitations: async () => [
            serverInvitation({ id: 'inv-2', estado: 'expirada' }),
            serverInvitation({ id: 'inv-1', estado: 'rechazada' }),
          ],
        }),
      );

      await expect(service.getInvitation('caso-1')).resolves.toBeNull();
    });

    it('completes pagoACargo from the session for the invitation this session created', async () => {
      // The endpoint does not select `pago_a_cargo`; we know it for an
      // invitation we sent ourselves.
      const service = createBackedCasesService(
        stubApi({
          createInvitation: async () =>
            serverInvitation({ id: 'inv-1', pagoACargo: 'invitado' }),
          listInvitations: async () => [serverInvitation({ id: 'inv-1' })],
        }),
      );
      await service.createInvitation({ casoId: 'caso-1', tipo: 'codigo', pagoACargo: 'invitado' });

      await expect(service.getInvitation('caso-1')).resolves.toMatchObject({
        id: 'inv-1',
        pagoACargo: 'invitado',
      });
    });

    it('does not lend that payer choice to a different invitation', async () => {
      // A second invitation issued from another device is a different row, and
      // its payer may well be the other one. Matching by caso instead of by id
      // would put the wrong party in front of a paywall.
      const service = createBackedCasesService(
        stubApi({
          createInvitation: async () =>
            serverInvitation({ id: 'inv-1', pagoACargo: 'invitado' }),
          listInvitations: async () => [serverInvitation({ id: 'inv-2' })],
        }),
      );
      await service.createInvitation({ casoId: 'caso-1', tipo: 'codigo', pagoACargo: 'invitado' });

      await expect(service.getInvitation('caso-1')).resolves.toMatchObject({
        id: 'inv-2',
        pagoACargo: null,
      });
    });

    it('does not leak one case’s invitation into another', async () => {
      const listInvitations = jest.fn(async (caseId: string) =>
        caseId === 'caso-1' ? [serverInvitation()] : [],
      );
      const service = createBackedCasesService(stubApi({ listInvitations }));

      await expect(service.getInvitation('caso-2')).resolves.toBeNull();
    });

    it('propagates a read failure so the screen can offer a retry', async () => {
      // Not null: a button that silently does nothing is worse than an error
      // state with a retry.
      const service = createBackedCasesService(
        stubApi({
          listInvitations: async () => {
            throw new Error('network_unavailable');
          },
        }),
      );

      await expect(service.getInvitation('caso-1')).rejects.toThrow('network_unavailable');
    });
  });

  describe('simulateInvitationAcceptance', () => {
    // The mock documents this as "a safe no-op that returns the current detail
    // unchanged, never an error". Against a real backend that is exactly a
    // re-read: nothing is simulated, and if the counterparty really joined via
    // POST /casos/unirse the estado has already changed on its own.
    it('re-reads the case rather than inventing a transition', async () => {
      const getCaseDetail = jest.fn(async () => activeDetail);
      const service = createBackedCasesService(stubApi({ getCaseDetail }));
      await expect(service.simulateInvitationAcceptance('caso-1')).resolves.toEqual(
        activeDetail,
      );
      expect(getCaseDetail).toHaveBeenCalledWith('caso-1');
    });

    it('never fabricates an estado the server did not report', async () => {
      const service = createBackedCasesService(stubApi({ getCaseDetail: async () => detail }));
      const result = await service.simulateInvitationAcceptance('caso-1');
      expect(result.estado).toBe('nuevo');
    });

    it('fails loudly when the case is gone, instead of returning a hollow object', async () => {
      const service = createBackedCasesService(
        stubApi({ getCaseDetail: async () => undefined }),
      );
      await expect(service.simulateInvitationAcceptance('caso-1')).rejects.toThrow(
        /caso-1/,
      );
    });
  });

  it('records the invitation only after the API accepted it', async () => {
    // Proven through pagoACargo, which is the only thing the session map
    // still contributes: a rejected POST must leave nothing behind, so the
    // server row comes back exactly as the server sent it.
    const service = createBackedCasesService(
      stubApi({
        createInvitation: async () => {
          throw new Error('rejected');
        },
        listInvitations: async () => [serverInvitation({ id: 'inv-1' })],
      }),
    );
    await expect(
      service.createInvitation({ casoId: 'caso-1', tipo: 'email', pagoACargo: 'invitado' }),
    ).rejects.toThrow('rejected');
    await expect(service.getInvitation('caso-1')).resolves.toMatchObject({
      pagoACargo: null,
    });
  });
});
