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
        createdAt: '2026-07-30T00:00:00.000Z',
      }) as CaseInvitation,
    getCaseTitle: async () => 'Custodia',
    joinCase: async () => ({ id: 'caso-1', estado: 'activo' }),
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
    // The API has no read endpoint for invitations — only POST. So the only
    // invitation this app can report is one it created itself.
    it('is null before anything was created, which callers already handle', async () => {
      const service = createBackedCasesService(stubApi());
      await expect(service.getInvitation('caso-1')).resolves.toBeNull();
    });

    it('returns the invitation this session created for that case', async () => {
      const service = createBackedCasesService(stubApi());
      const created = await service.createInvitation({ casoId: 'caso-1', tipo: 'email' });
      await expect(service.getInvitation('caso-1')).resolves.toEqual(created);
    });

    it('does not leak one case’s invitation into another', async () => {
      const service = createBackedCasesService(stubApi());
      await service.createInvitation({ casoId: 'caso-1', tipo: 'email' });
      await expect(service.getInvitation('caso-2')).resolves.toBeNull();
    });

    it('keeps the newest invitation when a case is invited twice', async () => {
      let n = 0;
      const service = createBackedCasesService(
        stubApi({
          createInvitation: async () => {
            n += 1;
            return { id: `inv-${n}`, caseId: 'caso-1', tipo: 'email', token: `tok-${n}`, emailDestino: null, estado: 'pendiente', createdAt: 'x' } as CaseInvitation;
          },
        }),
      );
      await service.createInvitation({ casoId: 'caso-1', tipo: 'email' });
      await service.createInvitation({ casoId: 'caso-1', tipo: 'email' });
      await expect(service.getInvitation('caso-1')).resolves.toMatchObject({ id: 'inv-2' });
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
    const service = createBackedCasesService(
      stubApi({
        createInvitation: async () => {
          throw new Error('rejected');
        },
      }),
    );
    await expect(
      service.createInvitation({ casoId: 'caso-1', tipo: 'email' }),
    ).rejects.toThrow('rejected');
    await expect(service.getInvitation('caso-1')).resolves.toBeNull();
  });
});
