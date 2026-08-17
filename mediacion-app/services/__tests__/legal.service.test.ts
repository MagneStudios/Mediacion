import { mockLegalDocuments } from '../../mocks/legal';
import type { LegalDocument } from '../../types/legal';
import {
  __mockForceLegalFailure,
  __resetMockLegalState,
  createMockLegalService,
} from '../legal.service';

describe('legal.service — TyC acceptance module', () => {
  beforeEach(() => {
    __resetMockLegalState();
  });

  it('serves the current (validTo null) version of each document, with the real Golosetti text', async () => {
    const service = createMockLegalService();
    const terms = await service.getCurrentDocument('terms');
    const privacy = await service.getCurrentDocument('privacy');

    expect(terms).toEqual(expect.objectContaining({ tipo: 'terms', version: 'v1.0', validTo: null }));
    expect(privacy).toEqual(expect.objectContaining({ tipo: 'privacy', version: 'v1.0', validTo: null }));
    // The wording comes from the data, and the [COMPLETAR] placeholders stay
    // visible — they are Administración's pending inputs, not ours to hide.
    expect(terms?.contenido).toContain('COMPLETAR');
    expect(privacy?.contenido).toContain('COMPLETAR');
  });

  it('the visible last-updated date comes from the document data, not from any component', async () => {
    const service = createMockLegalService();
    const terms = await service.getCurrentDocument('terms');
    expect(terms?.validFrom).toBe(mockLegalDocuments[0].validFrom);
  });

  describe('"vigente" matches LegalRepository.findVigente', () => {
    // NOTE on the fixture below: in the real schema
    // `legal_documents_tipo_vigente_unique ON (tipo) WHERE valid_to IS NULL`
    // allows only ONE row per tipo with a null validTo, so publishing v2.0
    // ahead of time also closes v1.0's validTo. The mock array is not under
    // that index, so the fixture sets both explicitly to keep the state
    // reachable — a fixture with two null validTo would be testing a database
    // state that cannot exist.
    // `findVigente` filters `valid_from <= now AND (valid_to IS NULL OR
    // valid_to > now)`. Publishing schedules a version ahead of time — the
    // aviso job mails users 10 days before it applies — so a version whose
    // valid_from is in the future must NOT be served yet.
    const scheduled: LegalDocument = {
      tipo: 'terms',
      version: 'v2.0',
      contenido: '## A. NUEVO\n\nA.1. Texto futuro.',
      validFrom: '2099-01-01T00:00:00.000Z',
      validTo: null,
      isSubstantial: true,
      resumenCambios: 'Cambió cómo se cobra.',
    };

    /** Every doc this block pushes, removed even when an assertion throws. */
    const pushed: LegalDocument[] = [];

    function push(...documents: LegalDocument[]): void {
      mockLegalDocuments.unshift(...documents);
      pushed.push(...documents);
    }

    afterEach(() => {
      for (const document of pushed) {
        const index = mockLegalDocuments.indexOf(document);
        if (index >= 0) mockLegalDocuments.splice(index, 1);
      }
      pushed.length = 0;
      // The seeded v1.0 rows are shared module state: restore the validTo the
      // scheduling helper closed, or every later test sees no current version.
      for (const document of mockLegalDocuments) {
        document.validTo = null;
      }
    });

    /** Schedules `scheduled` the way the partial unique index requires. */
    function schedule(): void {
      for (const document of mockLegalDocuments) {
        if (document.tipo === 'terms') {
          document.validTo = scheduled.validFrom;
        }
      }
      push(scheduled);
    }

    it('does not serve a version scheduled for the future', async () => {
      schedule();
      const service = createMockLegalService();

      const served = await service.getCurrentDocument('terms');
      // The seeded v1.0 keeps applying until v2.0 actually takes effect.
      expect(served?.version).toBe('v1.0');
    });

    it('serves that same scheduled version to the banner, which is what feeds the advance notice', async () => {
      schedule();
      const service = createMockLegalService();

      const announced = await service.getScheduledDocument('terms');

      // The mirror of the assertion above: what `getCurrentDocument` refuses
      // to serve is exactly what the banner has to announce.
      expect(announced?.version).toBe('v2.0');
    });

    it('announces nothing when every version is already in force', async () => {
      const service = createMockLegalService();

      await expect(service.getScheduledDocument('terms')).resolves.toBeUndefined();
    });

    it('announces the nearest publication when two are scheduled', async () => {
      const later: LegalDocument = { ...scheduled, version: 'v3.0', validFrom: '2099-06-01T00:00:00.000Z', validTo: null };
      schedule();
      push(later);
      const service = createMockLegalService();

      const announced = await service.getScheduledDocument('terms');

      expect(announced?.version).toBe('v2.0');
    });

    it('a scheduled substantial version does not trigger the blocking gate early', async () => {
      schedule();
      const service = createMockLegalService();

      const status = await service.getAcceptanceStatus();
      // v1.0 is still pending (nothing accepted in a fresh mock), but the
      // gate must not block: v2.0 is the substantial one and it does not
      // apply yet. Blocking the app before the new terms take effect would
      // be worse than not warning at all — the advance notice the
      // instructivo asks for is a banner, not a wall.
      expect(status.requiereReaceptacion).toBe(false);
    });

    it('does not serve a version whose validTo already passed', async () => {
      const service = createMockLegalService();
      const expired: LegalDocument = { ...scheduled, validFrom: '2020-01-01T00:00:00.000Z', validTo: '2021-01-01T00:00:00.000Z' };
      push(expired);

      const served = await service.getCurrentDocument('terms');
      expect(served?.version).toBe('v1.0');

      mockLegalDocuments.splice(mockLegalDocuments.indexOf(expired), 1);
    });
  });

  it('starts with both documents pending acceptance', async () => {
    const service = createMockLegalService();
    await expect(service.getAcceptanceStatus()).resolves.toEqual({
      pendientes: expect.arrayContaining(['terms', 'privacy']),
      requiereReaceptacion: false,
    });
  });

  it('registering an acceptance clears the pending list', async () => {
    const service = createMockLegalService();
    await service.registerAcceptance({ marketing: false });
    await expect(service.getAcceptanceStatus()).resolves.toEqual({
      pendientes: [],
      requiereReaceptacion: false,
    });
  });

  it('a marketing "no" is a valid acceptance — it never blocks', async () => {
    const service = createMockLegalService();
    await expect(service.registerAcceptance({ marketing: false })).resolves.toBeUndefined();
  });

  it('withdrawal requests get a tracking id and a server-side timestamp', async () => {
    const service = createMockLegalService();
    const receipt = await service.requestWithdrawal({
      nombre: 'Ana Pérez',
      email: 'ana@example.com',
      detalle: 'Plan estudio, contratado el 10/08',
    });
    // Uppercase, matching BE's trigger (`'ARR-' || lpad(...)`) — the code a
    // user reads in the demo has the same shape as a real one.
    expect(receipt.id).toMatch(/^ARR-\d{4}$/);
    // The mock always stamps it; the type is nullable only to mirror BE.
    expect(receipt.receivedAt).not.toBeNull();
    expect(Date.parse(receipt.receivedAt ?? '')).not.toBeNaN();
  });

  it('issues contact tracking codes on their own sequence, matching BE prefixes', async () => {
    const service = createMockLegalService();
    const first = await service.requestContact({
      nombre: 'Ana',
      email: 'ana@example.com',
      mensaje: 'Consulta',
    });
    // BE generates `CON-nnnn` from a sequence separate from `ARR-nnnn`;
    // sharing a counter here would let the demo drift from that.
    expect(first.id).toMatch(/^CON-\d{4}$/);

    const withdrawal = await service.requestWithdrawal({
      nombre: 'Ana',
      email: 'ana@example.com',
      detalle: 'Plan estudio',
    });
    expect(withdrawal.id).toMatch(/^ARR-\d{4}$/);
  });

  it('rejects a contact request with missing fields', async () => {
    const service = createMockLegalService();
    await expect(
      service.requestContact({ nombre: 'Ana', email: 'ana@example.com', mensaje: '   ' }),
    ).rejects.toThrow('contact_missing_fields');
  });

  it('rejects a withdrawal request with missing fields', async () => {
    const service = createMockLegalService();
    await expect(
      service.requestWithdrawal({ nombre: '  ', email: 'ana@example.com', detalle: 'x' }),
    ).rejects.toThrow('withdrawal_missing_fields');
  });

  it('surfaces forced failures as rejections (recoverable-error path)', async () => {
    const service = createMockLegalService();
    __mockForceLegalFailure('getCurrentDocument');
    await expect(service.getCurrentDocument('terms')).rejects.toThrow('mock_get_legal_document_failed');
    // One-shot: the next call succeeds again.
    await expect(service.getCurrentDocument('terms')).resolves.toBeDefined();
  });

  it('company info still reports the pending datos societarios', async () => {
    const service = createMockLegalService();
    const info = await service.getCompanyInfo();
    // These stay null until Administración provides them — a non-null value
    // here without a real source would be invented data.
    expect(info.razonSocial).toBeNull();
    expect(info.cuit).toBeNull();
    expect(info.plazoRespuestaDias).toBeGreaterThan(0);
  });
});
