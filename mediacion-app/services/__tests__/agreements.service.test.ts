import { __testDeriveAgreementState } from '../agreements.service';
import type { SharedAgreement, SharedSignerStatus } from '../../types/agreement';

function makeAgreement(overrides: Partial<SharedAgreement> = {}): SharedAgreement {
  return {
    id: 'agr-test-1',
    caseId: 'case-test',
    sourceProposalId: 'prop-1',
    sourceRoundNumber: 1,
    title: 'Test Agreement',
    summary: '',
    terms: [],
    estado: 'borrador',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSigners(overrides: Partial<SharedSignerStatus>[]): SharedSignerStatus[] {
  return overrides.map((o) => ({
    role: 'authenticated_party',
    status: 'pendiente',
    ...o,
  }));
}

describe('buildAgreementState — signature-completion derivation', () => {
  it('firmado with both signers complete → signatures complete, not waiting', () => {
    const agreement = makeAgreement({ estado: 'firmado' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'firmado' },
      { role: 'other_party', status: 'firmado' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.allSignaturesComplete).toBe(true);
    expect(state.waitingForOtherParty).toBe(false);
    expect(state.ownSignatureComplete).toBe(true);
    expect(state.readOnly).toBe(true);
  });

  it('con_aviso with both signers complete → signatures complete, not waiting', () => {
    const agreement = makeAgreement({ estado: 'con_aviso' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'firmado' },
      { role: 'other_party', status: 'firmado' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.allSignaturesComplete).toBe(true);
    expect(state.waitingForOtherParty).toBe(false);
    expect(state.ownSignatureComplete).toBe(true);
    expect(state.readOnly).toBe(true);
  });

  it('enviado_a_firma with own signed and other pending → waiting for other party', () => {
    const agreement = makeAgreement({ estado: 'enviado_a_firma' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'firmado' },
      { role: 'other_party', status: 'pendiente' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.allSignaturesComplete).toBe(false);
    expect(state.waitingForOtherParty).toBe(true);
    expect(state.ownSignatureComplete).toBe(true);
    expect(state.readOnly).toBe(false);
  });

  it('enviado_a_firma with own still pending → not waiting (own has not signed yet)', () => {
    const agreement = makeAgreement({ estado: 'enviado_a_firma' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'pendiente' },
      { role: 'other_party', status: 'pendiente' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.allSignaturesComplete).toBe(false);
    expect(state.waitingForOtherParty).toBe(false);
    expect(state.ownSignatureComplete).toBe(false);
    expect(state.canSign).toBe(true);
  });

  it('borrador with both pending → not complete, not waiting', () => {
    const agreement = makeAgreement({ estado: 'borrador' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'pendiente' },
      { role: 'other_party', status: 'pendiente' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.allSignaturesComplete).toBe(false);
    expect(state.waitingForOtherParty).toBe(false);
    expect(state.canPrepareDocument).toBe(true);
    expect(state.canSign).toBe(false);
  });
});

describe('buildAgreementState — readOnly / canSign / canPrepareDocument gates', () => {
  it('con_aviso is readOnly and not signable', () => {
    const agreement = makeAgreement({ estado: 'con_aviso' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'firmado' },
      { role: 'other_party', status: 'firmado' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.readOnly).toBe(true);
    expect(state.canSign).toBe(false);
    expect(state.canPrepareDocument).toBe(false);
  });

  it('firmado is readOnly and not signable', () => {
    const agreement = makeAgreement({ estado: 'firmado' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'firmado' },
      { role: 'other_party', status: 'firmado' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.readOnly).toBe(true);
    expect(state.canSign).toBe(false);
    expect(state.canPrepareDocument).toBe(false);
  });

  it('enviado_a_firma with own pending is signable and not readOnly', () => {
    const agreement = makeAgreement({ estado: 'enviado_a_firma' });
    const signers = makeSigners([
      { role: 'authenticated_party', status: 'pendiente' },
      { role: 'other_party', status: 'pendiente' },
    ]);

    const state = __testDeriveAgreementState(agreement, signers);
    expect(state.readOnly).toBe(false);
    expect(state.canSign).toBe(true);
    expect(state.canPrepareDocument).toBe(false);
  });
});
