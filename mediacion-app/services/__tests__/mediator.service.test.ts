const mockGetNegotiationState = jest.fn();
const mockAppendMediatorActivity = jest.fn();
const mockAppendMediatorNotice = jest.fn();

jest.mock('../negotiation.service', () => ({
  negotiationService: {
    getNegotiationState: (...args: unknown[]) => mockGetNegotiationState(...args),
  },
}));
jest.mock('../activity.service', () => ({
  appendMediatorActivity: (...args: unknown[]) => mockAppendMediatorActivity(...args),
}));
jest.mock('../notices.service', () => ({
  appendMediatorNotice: (...args: unknown[]) => mockAppendMediatorNotice(...args),
}));

// eslint-disable-next-line import/first
import { createMockMediatorService } from '../mediator.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNegotiationState.mockResolvedValue({
    caseId: 'case-1',
    eligibility: 'ready',
    currentRound: { id: 'round-3', caseId: 'case-1', number: 3, estado: 'activa', mediatorAvailable: true },
    currentProposal: null,
    ownResponse: null,
    waitingForOtherParty: false,
    bothAccepted: false,
    roundResolved: false,
    mediatorAvailable: true,
  });
  mockAppendMediatorActivity.mockResolvedValue(undefined);
  mockAppendMediatorNotice.mockResolvedValue(undefined);
});

describe('mediatorService concurrency', () => {
  it('shares one request commit between concurrent callers', async () => {
    const service = createMockMediatorService();
    const [first, second] = await Promise.all([service.requestMediator('case-1'), service.requestMediator('case-1')]);

    expect(first.mediation?.id).toBe(second.mediation?.id);
    expect(mockGetNegotiationState).toHaveBeenCalledTimes(2);
    expect(mockAppendMediatorNotice).toHaveBeenCalledTimes(2);
    expect(mockAppendMediatorActivity).toHaveBeenCalledTimes(2);
    await expect(service.getMediatorActivity('case-1')).resolves.toHaveLength(2);
  });

  it('revalidates eligibility immediately before committing', async () => {
    const availableState = {
      caseId: 'case-2',
      eligibility: 'ready',
      currentRound: { id: 'round-3', caseId: 'case-2', number: 3, estado: 'activa', mediatorAvailable: true },
      currentProposal: null,
      ownResponse: null,
      waitingForOtherParty: false,
      bothAccepted: false,
      roundResolved: false,
      mediatorAvailable: true,
    };
    mockGetNegotiationState
      .mockResolvedValueOnce(availableState)
      .mockResolvedValueOnce({ ...availableState, currentRound: null, eligibility: 'read_only', mediatorAvailable: false });
    const service = createMockMediatorService();

    await expect(service.requestMediator('case-2')).rejects.toThrow('mediator_not_eligible');
    expect(mockAppendMediatorNotice).not.toHaveBeenCalled();
    expect(mockAppendMediatorActivity).not.toHaveBeenCalled();
    await expect(service.getMediatorActivity('case-2')).resolves.toEqual([]);
  });
});
