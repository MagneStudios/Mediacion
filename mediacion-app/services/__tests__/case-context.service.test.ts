import { mockCaseContexts } from '../../mocks/case-context';
import { createMockCaseContextService } from '../case-context.service';

describe('case-context.service (mock)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockCaseContexts)) {
      delete mockCaseContexts[key];
    }
  });

  it('returns an empty context for a new caseId', async () => {
    const service = createMockCaseContextService();
    const ctx = await service.getContext('case-new');
    expect(ctx.caseId).toBe('case-new');
    expect(ctx.integrantes).toEqual([]);
    expect(ctx.completedSections).toEqual([]);
  });

  it('saves a section and updates completedSections', async () => {
    const service = createMockCaseContextService();
    const entries = [
      {
        data: { id: 'm1', nombre: 'Ana', parentesco: 'hija' },
        visibility: 'shared' as const,
        ownerId: 'party-self',
      },
    ];
    const updated = await service.saveSection('case-1', 'integrantes', entries);
    expect(updated.integrantes).toHaveLength(1);
    expect(updated.completedSections).toContain('integrantes');
  });

  it('isolates contexts by caseId', async () => {
    const service = createMockCaseContextService();
    await service.saveSection('case-1', 'integrantes', [
      { data: { id: 'm1', nombre: 'Ana', parentesco: 'hija' }, visibility: 'shared', ownerId: 'party-self' },
    ]);
    const ctx2 = await service.getContext('case-2');
    expect(ctx2.integrantes).toHaveLength(0);
  });

  it('removes a section from completedSections when emptied', async () => {
    const service = createMockCaseContextService();
    await service.saveSection('case-1', 'integrantes', [
      { data: { id: 'm1', nombre: 'Ana', parentesco: 'hija' }, visibility: 'shared', ownerId: 'party-self' },
    ]);
    const updated = await service.saveSection('case-1', 'integrantes', []);
    expect(updated.completedSections).not.toContain('integrantes');
  });

  it('handles colegio as a single entry, not an array', async () => {
    const service = createMockCaseContextService();
    const entry = {
      data: { nombre: 'Escuela 5', turno: 'manana' as const },
      visibility: 'shared' as const,
      ownerId: 'party-self',
    };
    const updated = await service.saveSection('case-1', 'colegio', entry as any);
    expect(updated.colegio).not.toBeNull();
    expect(updated.colegio?.data.nombre).toBe('Escuela 5');
    expect(updated.completedSections).toContain('colegio');
  });
});
