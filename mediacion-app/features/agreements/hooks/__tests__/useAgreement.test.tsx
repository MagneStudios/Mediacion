import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { AgreementState } from '@/types/agreement';

const mockGetAgreementState = jest.fn();
const mockGetAgreementStateById = jest.fn();
const mockPrepareSignatureDocument = jest.fn();
const mockSubmitOwnMockSignature = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
jest.mock('@/services/agreements.service', () => ({
  agreementsService: {
    getAgreementState: (...args: unknown[]) => mockGetAgreementState(...args),
    getAgreementStateById: (...args: unknown[]) => mockGetAgreementStateById(...args),
    prepareSignatureDocument: (...args: unknown[]) => mockPrepareSignatureDocument(...args),
    submitOwnMockSignature: (...args: unknown[]) => mockSubmitOwnMockSignature(...args),
  },
}));

// eslint-disable-next-line import/first
import { useAgreement } from '../useAgreement';

function makeState(caseId: string, estado: AgreementState['agreement']['estado'] = 'enviado_a_firma'): AgreementState {
  return {
    agreement: {
      id: `agreement-${caseId}`,
      caseId,
      sourceProposalId: `proposal-${caseId}`,
      sourceRoundNumber: 1,
      title: `Agreement ${caseId}`,
      summary: '',
      terms: [],
      estado,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    signers: [
      { role: 'authenticated_party', status: estado === 'firmado' ? 'firmado' : 'pendiente' },
      { role: 'other_party', status: estado === 'firmado' ? 'firmado' : 'pendiente' },
    ],
    ownSignatureComplete: estado === 'firmado',
    waitingForOtherParty: false,
    allSignaturesComplete: estado === 'firmado',
    canPrepareDocument: estado === 'borrador',
    canSign: estado === 'enviado_a_firma',
    readOnly: estado === 'firmado' || estado === 'con_aviso',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = undefined;
});

afterEach(async () => {
  await cleanup();
});

describe('useAgreement addressed by acuerdo', () => {
  it('reads by id when one is given, and never by caso', async () => {
    mockGetAgreementStateById.mockResolvedValue(makeState('case-1'));
    const hook = await renderHook(() => useAgreement('case-1', 'agr-tenencia'));

    await waitFor(() => expect(hook.result.current.status).toBe('success'));
    expect(mockGetAgreementStateById).toHaveBeenCalledWith('agr-tenencia');
    expect(mockGetAgreementState).not.toHaveBeenCalled();
  });

  it('passes the id along when preparing, so the draft is sent as is', async () => {
    mockGetAgreementStateById.mockResolvedValue(makeState('case-1', 'borrador'));
    mockPrepareSignatureDocument.mockResolvedValue(makeState('case-1'));
    const hook = await renderHook(() => useAgreement('case-1', 'agr-tenencia'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      await hook.result.current.prepareDocument();
    });

    expect(mockPrepareSignatureDocument).toHaveBeenCalledWith('case-1', 'agr-tenencia');
  });

  it('treats another acuerdo of the same caso as a different screen', async () => {
    // Two materias share a caseId. Keeping the state keyed by caso would
    // show tenencia's document under alimentos' id until the read lands —
    // on the screen that signs.
    const tenencia = deferred<AgreementState | null>();
    const alimentos = deferred<AgreementState | null>();
    mockGetAgreementStateById.mockImplementation((id: string) =>
      id === 'agr-tenencia' ? tenencia.promise : alimentos.promise,
    );

    const hook = await renderHook<ReturnType<typeof useAgreement>, { agreementId: string }>(
      ({ agreementId }) => useAgreement('case-1', agreementId),
      { initialProps: { agreementId: 'agr-tenencia' } },
    );
    await act(async () => {
      tenencia.resolve({ ...makeState('case-1'), agreement: { ...makeState('case-1').agreement, id: 'agr-tenencia' } });
      await tenencia.promise;
    });
    await waitFor(() => expect(hook.result.current.state?.agreement.id).toBe('agr-tenencia'));

    await hook.rerender({ agreementId: 'agr-alimentos' });
    expect(hook.result.current.status).toBe('loading');
    expect(hook.result.current.state).toBeNull();

    await act(async () => {
      alimentos.resolve({ ...makeState('case-1'), agreement: { ...makeState('case-1').agreement, id: 'agr-alimentos' } });
      await alimentos.promise;
    });
    await waitFor(() => expect(hook.result.current.state?.agreement.id).toBe('agr-alimentos'));
  });
});

describe('useAgreement hardening', () => {
  it('shows an error when the initial load fails', async () => {
    mockGetAgreementState.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useAgreement('case-1'));

    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.state).toBeNull();
  });

  it('keeps the last successful state when a focus refresh fails', async () => {
    const initial = makeState('case-1');
    mockGetAgreementState.mockResolvedValueOnce(initial).mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useAgreement('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.state).toEqual(initial);
  });

  it('allows only one synchronous call for each mutation', async () => {
    const initial = makeState('case-1');
    mockGetAgreementState.mockResolvedValue(initial);
    const hook = await renderHook(() => useAgreement('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    const preparation = deferred<AgreementState>();
    mockPrepareSignatureDocument.mockReturnValue(preparation.promise);
    let firstPreparation!: Promise<void>;
    let secondPreparation!: Promise<void>;
    await act(() => {
      firstPreparation = hook.result.current.prepareDocument();
      secondPreparation = hook.result.current.prepareDocument();
    });
    expect(mockPrepareSignatureDocument).toHaveBeenCalledTimes(1);
    await act(async () => {
      preparation.resolve(makeState('case-1'));
      await Promise.all([firstPreparation, secondPreparation]);
    });

    const signature = deferred<AgreementState>();
    mockSubmitOwnMockSignature.mockReturnValue(signature.promise);
    let firstSignature!: Promise<void>;
    let secondSignature!: Promise<void>;
    await act(() => {
      firstSignature = hook.result.current.submitSignature(initial.agreement.id);
      secondSignature = hook.result.current.submitSignature(initial.agreement.id);
    });
    expect(mockSubmitOwnMockSignature).toHaveBeenCalledTimes(1);
    await act(async () => {
      signature.resolve(makeState('case-1', 'firmado'));
      await Promise.all([firstSignature, secondSignature]);
    });
  });

  it('never renders or commits a late result from the previous case', async () => {
    const caseOneRead = deferred<AgreementState | null>();
    const caseTwoRead = deferred<AgreementState | null>();
    mockGetAgreementState.mockImplementation((caseId: string) =>
      caseId === 'case-1' ? caseOneRead.promise : caseTwoRead.promise,
    );

    const hook = await renderHook<ReturnType<typeof useAgreement>, { caseId: string }>(({ caseId }) => useAgreement(caseId), {
      initialProps: { caseId: 'case-1' },
    });
    await hook.rerender({ caseId: 'case-2' });
    expect(hook.result.current.status).toBe('loading');
    expect(hook.result.current.state).toBeNull();
    await act(async () => {
      caseTwoRead.resolve(makeState('case-2'));
      await caseTwoRead.promise;
    });
    await waitFor(() => expect(hook.result.current.state?.agreement.caseId).toBe('case-2'));

    await act(async () => {
      caseOneRead.resolve(makeState('case-1'));
      await caseOneRead.promise;
    });
    expect(hook.result.current.state?.agreement.caseId).toBe('case-2');
  });

  it('ignores a mutation response after navigation while allowing the domain request to finish', async () => {
    mockGetAgreementState.mockImplementation((caseId: string) => Promise.resolve(makeState(caseId)));
    const signature = deferred<AgreementState>();
    mockSubmitOwnMockSignature.mockReturnValue(signature.promise);

    const hook = await renderHook<ReturnType<typeof useAgreement>, { caseId: string }>(({ caseId }) => useAgreement(caseId), {
      initialProps: { caseId: 'case-1' },
    });
    await waitFor(() => expect(hook.result.current.status).toBe('success'));
    let request!: Promise<void>;
    await act(() => {
      request = hook.result.current.submitSignature('agreement-case-1');
    });

    await hook.rerender({ caseId: 'case-2' });
    await waitFor(() => expect(hook.result.current.state?.agreement.caseId).toBe('case-2'));
    await act(async () => {
      signature.resolve(makeState('case-1', 'firmado'));
      await request;
    });

    expect(hook.result.current.state?.agreement.caseId).toBe('case-2');
    expect(hook.result.current.signStatus).toBe('idle');
  });
});
